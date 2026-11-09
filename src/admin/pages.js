import { escapeHTML, sanitizeUrl } from '../utils/html.js';
import adminHtml from '../templates/admin.html';
import adminCss from '../templates/admin.css';
import adminJsText from '../templates/admin.js.txt';
import loginHtml from '../templates/login.html';

// 管理员已登录时，返回内嵌后台样式的管理页面。
export function renderAdminPage() {
  const html = adminHtml.replace(
    '<link rel="stylesheet" href="/static/admin.css">',
    `<style>${adminCss}</style>`
  );
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// 访问登录页或登录失败时，返回页面并安全显示提示。
export function renderLoginPage(message = '') {
  if (!message) {
    return new Response(loginHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  // 登录失败时注入已转义的中文提示。
  const safeMessage = escapeHTML(message);
  const html = loginHtml.replace(
    '<div class="error-message">用户名或密码错误</div>',
    `<div class="error-message" style="display:block;">${safeMessage}</div>`
  );
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// 浏览器请求后台资源时，返回内置的模板、样式或脚本。
export function handleStatic(request) {
  const url = new URL(request.url);
  const filePath = url.pathname.replace('/static/', '');

  const files = {
    'admin.html': { content: adminHtml, type: 'text/html; charset=utf-8' },
    'admin.css': { content: adminCss, type: 'text/css; charset=utf-8' },
    // 下发脚本时复用服务端的纯函数，避免浏览器端另写转义与网址校验。
    'admin.js': { content: `const escapeHTML = ${escapeHTML.toString()};\nconst normalizeUrl = ${sanitizeUrl.toString()};\n${adminJsText}`, type: 'application/javascript; charset=utf-8' },
  };

  const file = files[filePath];
  if (!file) return new Response('资源不存在', { status: 404 });
  return new Response(file.content, { headers: { 'Content-Type': file.type } });
}
