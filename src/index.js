import { handleApiRequest } from './api/router.js';
import { handleAdminRequest } from './admin/router.js';
import { handleFrontendRequest } from './frontend/renderer.js';

export default {
  // Worker 收到请求时，按路径交给接口、后台或前台处理。
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      return handleApiRequest(request, env, ctx);
    } else if (url.pathname === '/admin' || url.pathname === '/admin/logout' || url.pathname.startsWith('/static')) {
      return handleAdminRequest(request, env, ctx);
    } else {
      return handleFrontendRequest(request, env, ctx);
    }
  },
};
