import { readSettings, saveSettings } from '../utils/settings.js';
import { sanitizeUrl } from '../utils/html.js';
import { jsonResponse, errorResponse, serverErrorResponse } from '../utils/response.js';

// 查询系统设置时调用，返回博客链接与显示状态。
export async function getSettings(env) {
  try {
    const data = await readSettings(env);
    return jsonResponse({ code: 200, data });
  } catch (error) {
    return serverErrorResponse('加载设置失败', error);
  }
}

// 保存系统设置时调用，校验博客网址并持久化存储。
export async function updateSettings(request, env) {
  try {
    const body = await request.json();
    const blog_enabled = Boolean(body.blog_enabled);
    const rawUrl = (body.blog_url || '').trim();
    const normalizedUrl = sanitizeUrl(rawUrl);

    if (blog_enabled && !normalizedUrl) {
      return errorResponse('请输入有效的博客链接', 400);
    }

    const data = await saveSettings(env, {
      blog_url: normalizedUrl || rawUrl,
      blog_enabled,
    });

    return jsonResponse({ code: 200, message: '设置保存成功', data });
  } catch (error) {
    return serverErrorResponse('保存设置失败', error);
  }
}
