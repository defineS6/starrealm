import { isSubmissionEnabled } from '../admin/auth.js';
import { errorResponse, jsonResponse, serverErrorResponse } from '../utils/response.js';

// 打开待审核列表时，分页读取访客投稿。
export async function getPendingConfig(env, url) {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const offset = (page - 1) * pageSize;
  try {
    const { results } = await env.NAV_DB.prepare(
      'SELECT * FROM pending_sites ORDER BY create_time DESC LIMIT ? OFFSET ?'
    ).bind(pageSize, offset).all();
    const countResult = await env.NAV_DB.prepare('SELECT COUNT(*) as total FROM pending_sites').first();
    const total = countResult ? countResult.total : 0;
    return jsonResponse({ code: 200, data: results, total, page, pageSize });
  } catch (e) {
    return serverErrorResponse('加载待审核书签失败', e);
  }
}

// 通过审核时，将投稿转入正式书签并移除待审核记录。
export async function approvePendingConfig(env, id) {
  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM pending_sites WHERE id = ?').bind(id).all();
    if (results.length === 0) return errorResponse('待审核书签不存在', 404);
    const config = results[0];
    await env.NAV_DB.prepare(
      'INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, 9999)'
    ).bind(config.name, config.url, config.logo, config.desc, config.catelog).run();
    await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
    return jsonResponse({ code: 200, message: '书签已通过审核' });
  } catch (e) {
    return serverErrorResponse('审核书签失败', e);
  }
}

// 拒绝投稿时，删除待审核记录。
export async function rejectPendingConfig(env, id) {
  try {
    const del = await env.NAV_DB.prepare('DELETE FROM pending_sites WHERE id = ?').bind(id).run();
    if (!del.meta.changes) return errorResponse('待审核书签不存在', 404);
    return jsonResponse({ code: 200, message: '投稿已拒绝' });
  } catch (e) {
    return serverErrorResponse('拒绝投稿失败', e);
  }
}

// 访客提交时检查开关与必填项，再写入待审核列表。
export async function submitConfig(request, env) {
  try {
    if (!isSubmissionEnabled(env)) return errorResponse('访客投稿已关闭', 403);
    const config = await request.json();
    const { name, url, logo, desc, catelog } = config;
    const sName = (name || '').trim();
    const sUrl = (url || '').trim();
    const sCatelog = (catelog || '').trim();
    const sLogo = (logo || '').trim() || null;
    const sDesc = (desc || '').trim() || null;

    if (!sName || !sUrl || !sCatelog) return errorResponse('名称、网址和分类不能为空', 400);

    await env.NAV_DB.prepare(
      'INSERT INTO pending_sites (name, url, logo, desc, catelog) VALUES (?, ?, ?, ?, ?)'
    ).bind(sName, sUrl, sLogo, sDesc, sCatelog).run();

    return jsonResponse({ code: 201, message: '提交成功，等待审核' }, 201);
  } catch (e) {
    return serverErrorResponse('提交书签失败', e);
  }
}
