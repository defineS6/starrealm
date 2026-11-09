import { validateAdminSession, destroyAdminSession, createAdminSession, buildSessionCookie } from './auth.js';
import { renderAdminPage, renderLoginPage, handleStatic } from './pages.js';

// 访问后台、登录退出或静态资源时，分发请求并处理会话。
export async function handleAdminRequest(request, env, ctx) {
  const url = new URL(request.url);

  // 退出时同时清除服务端会话与根路径下的浏览器 Cookie。
  if (url.pathname === '/admin/logout') {
    if (request.method !== 'POST') return new Response('不支持此请求方式', { status: 405 });
    const { token } = await validateAdminSession(request, env);
    if (token) await destroyAdminSession(env, token);
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/admin',
        'Set-Cookie': buildSessionCookie('', { maxAge: 0 }),
      },
    });
  }

  if (url.pathname === '/admin') {
    if (request.method === 'POST') {
      const formData = await request.formData();
      const name = (formData.get('name') || '').trim();
      const password = (formData.get('password') || '').trim();

      const storedUsername = await env.NAV_AUTH.get('admin_username');
      const storedPassword = await env.NAV_AUTH.get('admin_password');

      const isValid = storedUsername && storedPassword && name === storedUsername && password === storedPassword;

      if (isValid) {
        const token = await createAdminSession(env);
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin', 'Set-Cookie': buildSessionCookie(token) },
        });
      }
      return renderLoginPage('账号或密码错误，请重试。');
    }

    const session = await validateAdminSession(request, env);
    if (session.authenticated) {
      const response = renderAdminPage();
      if (session.cookie) response.headers.set('Set-Cookie', session.cookie);
      return response;
    }
    return renderLoginPage();
  }

  if (url.pathname.startsWith('/static')) {
    return handleStatic(request);
  }

  return new Response('页面不存在', { status: 404 });
}
