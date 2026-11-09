import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, runInNewContext } from 'node:vm';
import { jsonResponse, errorResponse, serverErrorResponse } from './response.js';
import { buildCategoryList, readCategoryOrders } from './categories.js';
import { readSettings, saveSettings } from './settings.js';
import { escapeHTML, sanitizeUrl } from './html.js';
import { handleApiRequest } from '../api/router.js';

// 测试页面渲染时，用文本常量替代 Wrangler 的模板导入，无需读取部署配置。
async function loadPageModule(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  let source = await readFile(url, 'utf8');
  const matches = [...source.matchAll(/import (\w+) from '([^']+\.(?:html|css|txt))';/g)];
  for (const [statement, name, path] of matches) {
    const content = await readFile(new URL(path, url), 'utf8');
    source = source.replace(statement, `const ${name} = ${JSON.stringify(content)};`);
  }
  source = source.replace(/from '(\.\.?\/[^']+\.js)'/g, (_, path) => `from '${new URL(path, url).href}'`);
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
}

// 测试接口与页面时，提供只在内存中保存的数据库和会话替身。
function createEnv(sites = [], orders = [], initialSettings = []) {
  const settingsMap = new Map(initialSettings.map(s => [s.key, s.value]));
  return {
    NAV_AUTH: {
      get: async key => key.startsWith('session:') ? '{}' : null,
      put: async () => {},
    },
    NAV_DB: {
      prepare: query => {
        const statement = {
          bind: (...args) => {
            statement.lastArgs = args;
            return statement;
          },
          all: async () => {
            if (query.includes('category_orders')) return { results: orders };
            if (query.includes('settings')) {
              return { results: Array.from(settingsMap.entries()).map(([key, value]) => ({ key, value })) };
            }
            return { results: sites };
          },
          first: async () => query.includes('COUNT') ? { total: sites.length } : sites[0] || null,
          run: async () => {
            if (query.includes('settings') && statement.lastArgs) {
              settingsMap.set(statement.lastArgs[0], String(statement.lastArgs[1]));
            }
            return { meta: { changes: 1 } };
          },
        };
        return statement;
      },
      batch: async stmts => {
        for (const s of stmts) await s.run();
        return [];
      },
    },
  };
}

test('公共响应保持状态码和数据结构，并明确中文编码', async () => {
  const ok = jsonResponse({ code: 201, message: '添加成功' }, 201);
  assert.equal(ok.status, 201);
  assert.match(ok.headers.get('Content-Type'), /charset=utf-8/);
  assert.deepEqual(await ok.json(), { code: 201, message: '添加成功' });
  const failure = errorResponse('请先登录', 401);
  assert.equal(failure.status, 401);
  assert.deepEqual(await failure.json(), { code: 401, message: '请先登录' });
});

test('服务端异常保留日志，但不向用户返回异常细节', async t => {
  const log = t.mock.method(console, 'error', () => {});
  const error = new Error('数据库内部信息');
  const response = serverErrorResponse('加载失败', error);
  assert.equal(response.status, 500);
  assert.equal((await response.json()).message, '加载失败');
  assert.equal(log.mock.calls[0].arguments[1], error);
});

test('分类合并保留空分类、计数和三级排序', () => {
  const result = buildCategoryList([
    { catelog: '乙', site_count: 2, min_site_sort: 4 },
    { catelog: '甲', site_count: 1, min_site_sort: 2 },
  ], new Map([['乙', 1], ['空分类', 0]]));
  assert.deepEqual(result.map(row => row.catelog), ['空分类', '乙', '甲']);
  assert.equal(result[0].site_count, 0);
  assert.equal(result[1].explicit, true);
  assert.equal(result[2].sort_order, 2);
  const tied = buildCategoryList([
    { catelog: '乙', site_count: 1, min_site_sort: 2 },
    { catelog: '甲', site_count: 1, min_site_sort: 1 },
  ], new Map([['甲', 0], ['乙', 0]]));
  assert.equal(tied[0].catelog, '甲');
});

test('分类排序兼容旧数据库，但不吞掉其他数据库故障', async () => {
  const env = createEnv();
  env.NAV_DB.prepare = () => ({ all: async () => { throw new Error('no such table: category_orders'); } });
  assert.equal((await readCategoryOrders(env)).size, 0);
  env.NAV_DB.prepare = () => ({ all: async () => { throw new Error('读取失败'); } });
  await assert.rejects(readCategoryOrders(env), /读取失败/);
});

test('接口鉴权、投稿开关与必填项返回中文提示', async () => {
  const env = createEnv();
  let response = await handleApiRequest(new Request('https://nav.test/api/config', { method: 'POST' }), env);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, '请先登录');
  env.ENABLE_PUBLIC_SUBMISSION = 'false';
  response = await handleApiRequest(new Request('https://nav.test/api/config/submit', { method: 'POST' }), env);
  assert.equal(response.status, 403);
  env.ENABLE_PUBLIC_SUBMISSION = 'true';
  response = await handleApiRequest(new Request('https://nav.test/api/config/submit', {
    method: 'POST', body: JSON.stringify({ name: '示例' }),
  }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, '名称、网址和分类不能为空');
});

test('书签新增、编辑、删除和投稿审核保持原有成功状态码', async () => {
  const site = { id: 1, name: '示例', url: 'https://example.com', catelog: '工具' };
  const env = createEnv([site]);
  for (const [path, method, expected] of [
    ['/config', 'POST', 201], ['/config/1', 'PUT', 200], ['/config/1', 'DELETE', 200],
    ['/config/import', 'POST', 201], ['/pending/1', 'PUT', 200], ['/pending/1', 'DELETE', 200],
    ['/config/submit', 'POST', 201],
  ]) {
    const response = await handleApiRequest(new Request(`https://nav.test/api${path}`, {
      method, headers: { Cookie: 'nav_admin_session=test' },
      body: method === 'DELETE' ? undefined : JSON.stringify(path === '/config/import' ? [site] : site),
    }), env);
    assert.equal(response.status, expected, `${method} ${path}`);
    assert.equal((await response.json()).code, expected);
  }
});

test('接口数据库故障不再外泄错误详情', async t => {
  t.mock.method(console, 'error', () => {});
  const env = createEnv();
  env.NAV_DB.prepare = () => { throw new Error('敏感数据库路径'); };
  const response = await handleApiRequest(new Request('https://nav.test/api/config'), env);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { code: 500, message: '加载书签失败' });
});

test('前台渲染保留预建分类、转义和投稿开关', async () => {
  const { handleFrontendRequest } = await loadPageModule('../frontend/renderer.js');
  const env = createEnv([
    { id: 1, name: '<测试>', url: 'https://example.com', catelog: '工具', sort_order: 2 },
  ], [{ catelog: '空分类', sort_order: 0 }]);
  let html = await (await handleFrontendRequest(new Request('https://nav.test'), env)).text();
  assert.match(html, /&lt;测试&gt;/);
  assert.match(html, /空分类/);
  assert.match(html, /id="addSiteForm"/);
  assert.doesNotMatch(html, /\{\{[A-Z0-9_]+\}\}/);
  assert.match(html, /收藏 · 分类 · 极速检索/);
  assert.doesNotMatch(html, /OMC \/\/ CONSOLE|CYBER-ROCK/);
  assert.match(html, />摇滚<\/span>/);
  assert.doesNotMatch(html, />\s*🎸/);
  assert.match(html, /id="introStage"/);
  assert.match(html, /nav-intro-played/);
  assert.match(html, /intro-cascade/);
  env.ENABLE_PUBLIC_SUBMISSION = 'false';
  html = await (await handleFrontendRequest(new Request('https://nav.test/?catalog=空分类'), env)).text();
  assert.match(html, /暂无书签/);
  assert.doesNotMatch(html, /id="addSiteForm"/);
});

test('系统设置可读取与保存，并同步校验入口链接', async () => {
  const env = createEnv([], [], [
    { key: 'blog_url', value: 'https://custom.blog.com' },
    { key: 'blog_enabled', value: 'true' },
    { key: 'git_url', value: 'https://github.com/me/repo' },
    { key: 'git_enabled', value: 'false' },
  ]);
  const current = await readSettings(env);
  assert.equal(current.blog_url, 'https://custom.blog.com');
  assert.equal(current.blog_enabled, true);
  assert.equal(current.git_url, 'https://github.com/me/repo');
  assert.equal(current.git_enabled, false);

  await saveSettings(env, {
    blog_url: 'https://newblog.org',
    blog_enabled: false,
    git_url: 'https://github.com/me/new',
    git_enabled: true,
  });
  const updated = await readSettings(env);
  assert.equal(updated.blog_url, 'https://newblog.org/');
  assert.equal(updated.blog_enabled, false);
  assert.equal(updated.git_url, 'https://github.com/me/new');
  assert.equal(updated.git_enabled, true);

  // 接口鉴权与保存测试
  let unauth = await handleApiRequest(new Request('https://nav.test/api/settings', { method: 'GET' }), env);
  assert.equal(unauth.status, 401);

  let getResp = await handleApiRequest(new Request('https://nav.test/api/settings', {
    method: 'GET', headers: { Cookie: 'nav_admin_session=test' },
  }), env);
  assert.equal(getResp.status, 200);
  assert.equal((await getResp.json()).data.blog_url, 'https://newblog.org/');

  let badPost = await handleApiRequest(new Request('https://nav.test/api/settings', {
    method: 'POST', headers: { Cookie: 'nav_admin_session=test' },
    body: JSON.stringify({ blog_enabled: true, blog_url: 'not a url' }),
  }), env);
  assert.equal(badPost.status, 400);
  assert.equal((await badPost.json()).message, '请输入有效的博客链接');

  let badGit = await handleApiRequest(new Request('https://nav.test/api/settings', {
    method: 'POST', headers: { Cookie: 'nav_admin_session=test' },
    body: JSON.stringify({ blog_enabled: false, blog_url: '', git_enabled: true, git_url: '' }),
  }), env);
  assert.equal(badGit.status, 400);
  assert.equal((await badGit.json()).message, '请输入有效的仓库链接');
});

test('前台根据系统设置动态展示或隐藏博客与仓库入口', async () => {
  const { handleFrontendRequest } = await loadPageModule('../frontend/renderer.js');
  const site = { id: 1, name: '测试站点', url: 'https://example.com', catelog: '工具', sort_order: 1 };

  // 博客与仓库同时开启：博客在侧边栏，仓库图标在顶部工具栏
  const envEnabled = createEnv([site], [], [
    { key: 'blog_url', value: 'https://myblog.xyz' },
    { key: 'blog_enabled', value: 'true' },
    { key: 'git_url', value: 'https://github.com/me/repo' },
    { key: 'git_enabled', value: 'true' },
  ]);
  const htmlEnabled = await (await handleFrontendRequest(new Request('https://nav.test'), envEnabled)).text();
  assert.match(htmlEnabled, /href="https:\/\/myblog\.xyz\/"/);
  assert.match(htmlEnabled, />我的博客<\/span>/);
  assert.match(htmlEnabled, /href="https:\/\/github\.com\/me\/repo"/);
  assert.match(htmlEnabled, /aria-label="代码仓库"/);

  // 两个入口都关闭：侧边栏只剩后台管理，顶部无仓库图标
  const envDisabled = createEnv([site], [], [
    { key: 'blog_url', value: 'https://myblog.xyz' },
    { key: 'blog_enabled', value: 'false' },
    { key: 'git_url', value: 'https://github.com/me/repo' },
    { key: 'git_enabled', value: 'false' },
  ]);
  const htmlDisabled = await (await handleFrontendRequest(new Request('https://nav.test'), envDisabled)).text();
  assert.doesNotMatch(htmlDisabled, />我的博客<\/span>/);
  assert.doesNotMatch(htmlDisabled, /aria-label="代码仓库"/);
  assert.doesNotMatch(htmlDisabled, /href="https:\/\/myblog\.xyz/);
  assert.match(htmlDisabled, /grid-cols-1/);

  // 只开仓库：顶部保留图标，侧边栏无博客入口
  const envGitOnly = createEnv([site], [], [
    { key: 'blog_enabled', value: 'false' },
    { key: 'git_url', value: 'https://github.com/me/repo' },
    { key: 'git_enabled', value: 'true' },
  ]);
  const htmlGitOnly = await (await handleFrontendRequest(new Request('https://nav.test'), envGitOnly)).text();
  assert.match(htmlGitOnly, /aria-label="代码仓库"/);
  assert.doesNotMatch(htmlGitOnly, />我的博客<\/span>/);

  // 未配置任何记录时，仓库入口按默认值展示，博客入口保持空白
  const envDefault = createEnv([site]);
  const htmlDefault = await (await handleFrontendRequest(new Request('https://nav.test'), envDefault)).text();
  assert.match(htmlDefault, /aria-label="代码仓库"/);
  assert.match(htmlDefault, /https:\/\/github\.com\/defineS6\/starrealm/);
  assert.doesNotMatch(htmlDefault, />我的博客<\/span>/);
  assert.doesNotMatch(htmlDefault, /verydio/);
});

test('后台下发的浏览器工具与服务端保持一致', async () => {
  const { handleStatic, renderLoginPage } = await loadPageModule('../admin/pages.js');
  const source = await (await handleStatic(new Request('https://nav.test/static/admin.js'))).text();
  new Script(source);
  const helpers = source.slice(0, source.indexOf('const configTableBody'));
  for (const value of ['example.com', 'https://example.com/a?q=1', 'javascript:alert(1)', 'http://', '<测试>']) {
    const browser = runInNewContext(`${helpers}\n[escapeHTML(value), normalizeUrl(value)]`, { URL, value });
    assert.equal(browser[0], escapeHTML(value));
    assert.equal(browser[1], sanitizeUrl(value));
  }
  assert.equal(await (await handleStatic(new Request('https://nav.test/static/missing'))).text(), '资源不存在');
  const html = await renderLoginPage('<登录失败>').text();
  assert.match(html, /&lt;登录失败&gt;/);
  assert.doesNotMatch(html, /验证管理员凭据/);
});

test('页面内联脚本均通过语法检查', async () => {
  for (const path of ['../templates/frontend.html', '../templates/login.html', '../templates/admin.html']) {
    const html = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const [index, match] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries()) {
      new Script(match[1], { filename: `${path}:${index}` });
    }
  }
});
