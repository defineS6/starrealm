export const SESSION_COOKIE_NAME = 'nav_admin_session';
const SESSION_PREFIX = 'session:';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

// 校验会话前解析请求中的 Cookie，保留键值内容。
export function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').map(i => i.trim()).filter(Boolean).reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) { acc[pair] = ''; }
    else { acc[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim(); }
    return acc;
  }, {});
}

// 登录、续期或退出时，生成统一安全属性的会话 Cookie。
export function buildSessionCookie(token, options = {}) {
  const { maxAge = SESSION_TTL_SECONDS } = options;
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    'Secure',
  ].join('; ');
}

// 登录成功时创建随机令牌，并保存十二小时会话。
export async function createAdminSession(env) {
  const token = crypto.randomUUID();
  await env.NAV_AUTH.put(`${SESSION_PREFIX}${token}`, JSON.stringify({ createdAt: Date.now() }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

// 有效会话被访问时，延长服务端记录的有效期。
async function refreshAdminSession(env, token, payload) {
  await env.NAV_AUTH.put(`${SESSION_PREFIX}${token}`, payload, { expirationTtl: SESSION_TTL_SECONDS });
}

// 退出登录时删除令牌对应的会话。
export async function destroyAdminSession(env, token) {
  if (!token) return;
  await env.NAV_AUTH.delete(`${SESSION_PREFIX}${token}`);
}

// 访问后台或受保护接口时，验证令牌并生成续期 Cookie。
export async function validateAdminSession(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return { authenticated: false };
  const payload = await env.NAV_AUTH.get(`${SESSION_PREFIX}${token}`);
  if (!payload) return { authenticated: false };
  await refreshAdminSession(env, token, payload);
  // 刷新浏览器 Cookie 的过期时间
  const newCookie = buildSessionCookie(token);
  return { authenticated: true, token, cookie: newCookie };
}

// 接口鉴权时，返回当前请求是否有有效管理员会话。
export async function isAdminAuthenticated(request, env) {
  const { authenticated } = await validateAdminSession(request, env);
  return authenticated;
}

// 渲染投稿入口或接收投稿时，读取访客投稿开关。
export function isSubmissionEnabled(env) {
  const flag = env.ENABLE_PUBLIC_SUBMISSION;
  if (flag === undefined || flag === null) return true;
  return String(flag).trim().toLowerCase() === 'true';
}
