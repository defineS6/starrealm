import { isAdminAuthenticated, isSubmissionEnabled } from '../admin/auth.js';
import { getConfig, getConfigById, createConfig, updateConfig, deleteConfig, importConfig, exportConfig } from './sites.js';
import { getPendingConfig, approvePendingConfig, rejectPendingConfig, submitConfig } from './pending.js';
import { getCategories, createCategory, deleteCategory, updateCategoryOrder } from './categories.js';
import { getSettings, updateSettings } from './settings.js';
import { errorResponse, serverErrorResponse } from '../utils/response.js';

// 查询站点图标时调用第三方图标服务，未找到时返回空链接。
async function getFavicon(url) {
  if (!url) return errorResponse('请输入站点网址', 400);
  try {
    const target = new URL(url).hostname;
    const faviconUrl = `https://api.iowen.cn/favicon/${target}`;
    const resp = await fetch(faviconUrl, { method: 'HEAD' });
    if (resp.ok) {
      return Response.json({ code: 200, favicon: faviconUrl });
    }
  } catch (_) {}
  return Response.json({ code: 200, favicon: '' });
}

// 收到接口请求时分发路由，并在写入或审核前检查管理员身份。
export async function handleApiRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const method = request.method;
  const id = url.pathname.split('/').pop();

  try {
    if (path === '/favicon' && method === 'GET') {
      return await getFavicon(url.searchParams.get('url'));
    }

    if (path === '/config') {
      switch (method) {
        case 'GET': return await getConfig(env, url);
        case 'POST':
          if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
          return await createConfig(request, env);
        default: return errorResponse('不支持此请求方式', 405);
      }
    }

    if (path === '/config/submit' && method === 'POST') {
      if (!isSubmissionEnabled(env)) return errorResponse('访客投稿已关闭', 403);
      return await submitConfig(request, env);
    }

    if (path === '/config/import' && method === 'POST') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
      return await importConfig(request, env);
    }

    if (path === '/config/export' && method === 'GET') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
      return await exportConfig(env);
    }

    if (path === '/categories') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
      switch (method) {
        case 'GET': return await getCategories(env);
        case 'POST': return await createCategory(request, env);
        default: return errorResponse('不支持此请求方式', 405);
      }
    }

    if (path.startsWith('/categories/')) {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
      let categoryName;
      try {
        categoryName = decodeURIComponent(path.replace('/categories/', ''));
      } catch (_) {
        return errorResponse('分类名称编码不正确', 400);
      }
      if (method === 'PUT') return await updateCategoryOrder(request, env, categoryName);
      if (method === 'DELETE') return await deleteCategory(env, categoryName);
      return errorResponse('不支持此请求方式', 405);
    }

    if (path === `/config/${id}` && /^\d+$/.test(id)) {
      switch (method) {
        case 'GET': return await getConfigById(env, id);
        case 'PUT':
          if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
          return await updateConfig(request, env, id);
        case 'DELETE':
          if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
          return await deleteConfig(env, id);
        default: return errorResponse('不支持此请求方式', 405);
      }
    }

    if (path === '/pending' && method === 'GET') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
      return await getPendingConfig(env, url);
    }

    if (path.startsWith('/pending/') && /^\d+$/.test(id)) {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
      switch (method) {
        case 'PUT': return await approvePendingConfig(env, id);
        case 'DELETE': return await rejectPendingConfig(env, id);
        default: return errorResponse('不支持此请求方式', 405);
      }
    }

    if (path === '/settings') {
      if (!(await isAdminAuthenticated(request, env))) return errorResponse('请先登录', 401);
      switch (method) {
        case 'GET': return await getSettings(env);
        case 'POST':
        case 'PUT': return await updateSettings(request, env);
        default: return errorResponse('不支持此请求方式', 405);
      }
    }

    return errorResponse('接口不存在', 404);
  } catch (error) {
    return serverErrorResponse('服务暂时不可用，请稍后重试', error);
  }
}
