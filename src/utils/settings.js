import { sanitizeUrl } from './html.js';

export const DEFAULT_SETTINGS = {
  blog_url: 'https://blog.verydio.com/',
  blog_enabled: true,
};

// 读取系统设置，优先读取数据库配置，兼容未建表与 KV 存储。
export async function readSettings(env) {
  const settings = { ...DEFAULT_SETTINGS };

  // 1. 尝试从 D1 数据库读取
  try {
    if (env && env.NAV_DB) {
      const { results } = await env.NAV_DB.prepare('SELECT key, value FROM settings').all();
      if (Array.isArray(results) && results.length > 0) {
        for (const row of results) {
          if (row.key === 'blog_url' && typeof row.value === 'string') {
            settings.blog_url = row.value.trim();
          } else if (row.key === 'blog_enabled') {
            settings.blog_enabled = String(row.value).trim().toLowerCase() === 'true';
          }
        }
        return settings;
      }
    }
  } catch (error) {
    if (!/no such table/i.test(error.message || '')) throw error;
  }

  // 2. 数据库无表或无记录时，尝试从 KV 读取兜底配置
  try {
    if (env && env.NAV_AUTH && typeof env.NAV_AUTH.get === 'function') {
      const kvData = await env.NAV_AUTH.get('settings:site');
      if (kvData) {
        const parsed = JSON.parse(kvData);
        if (typeof parsed.blog_url === 'string') settings.blog_url = parsed.blog_url.trim();
        if (parsed.blog_enabled !== undefined) settings.blog_enabled = Boolean(parsed.blog_enabled);
        return settings;
      }
    }
  } catch (_) {}

  return settings;
}

// 管理员保存设置时调用，将博客链接与开关写入数据库并同步至 KV。
export async function saveSettings(env, { blog_url, blog_enabled }) {
  const normalizedUrl = sanitizeUrl(blog_url) || (blog_url || '').trim();
  const enabledBool = Boolean(blog_enabled);

  // 写入 D1
  if (env && env.NAV_DB) {
    const doBatch = async () => {
      await env.NAV_DB.batch([
        env.NAV_DB.prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        ).bind('blog_url', normalizedUrl),
        env.NAV_DB.prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        ).bind('blog_enabled', String(enabledBool)),
      ]);
    };

    try {
      await doBatch();
    } catch (error) {
      if (/no such table/i.test(error.message || '')) {
        await env.NAV_DB.prepare(
          'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'
        ).run();
        await doBatch();
      } else {
        throw error;
      }
    }
  }

  // 同步写入 KV 兜底
  if (env && env.NAV_AUTH && typeof env.NAV_AUTH.put === 'function') {
    try {
      await env.NAV_AUTH.put('settings:site', JSON.stringify({
        blog_url: normalizedUrl,
        blog_enabled: enabledBool,
      }));
    } catch (_) {}
  }

  return { blog_url: normalizedUrl, blog_enabled: enabledBool };
}
