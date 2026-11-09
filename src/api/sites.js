import { normalizeSortOrder } from '../utils/sort.js';
import { errorResponse, jsonResponse, serverErrorResponse } from '../utils/response.js';

// 请求书签列表时，按分类、关键词和页码查询。
export async function getConfig(env, url) {
  const catalog = url.searchParams.get('catalog');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const keyword = url.searchParams.get('keyword');
  const offset = (page - 1) * pageSize;

  try {
    let query = 'SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?';
    let countQuery = 'SELECT COUNT(*) as total FROM sites';
    let queryBindParams = [pageSize, offset];
    let countQueryParams = [];

    if (catalog) {
      query = 'SELECT * FROM sites WHERE catelog = ? ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as total FROM sites WHERE catelog = ?';
      queryBindParams = [catalog, pageSize, offset];
      countQueryParams = [catalog];
    }

    if (keyword) {
      const like = `%${keyword}%`;
      if (catalog) {
        query = 'SELECT * FROM sites WHERE catelog = ? AND (name LIKE ? OR url LIKE ? OR catelog LIKE ?) ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?';
        countQuery = 'SELECT COUNT(*) as total FROM sites WHERE catelog = ? AND (name LIKE ? OR url LIKE ? OR catelog LIKE ?)';
        queryBindParams = [catalog, like, like, like, pageSize, offset];
        countQueryParams = [catalog, like, like, like];
      } else {
        query = 'SELECT * FROM sites WHERE name LIKE ? OR url LIKE ? OR catelog LIKE ? ORDER BY sort_order ASC, create_time DESC LIMIT ? OFFSET ?';
        countQuery = 'SELECT COUNT(*) as total FROM sites WHERE name LIKE ? OR url LIKE ? OR catelog LIKE ?';
        queryBindParams = [like, like, like, pageSize, offset];
        countQueryParams = [like, like, like];
      }
    }

    const { results } = await env.NAV_DB.prepare(query).bind(...queryBindParams).all();
    const countResult = await env.NAV_DB.prepare(countQuery).bind(...countQueryParams).first();
    const total = countResult ? countResult.total : 0;

    return jsonResponse({ code: 200, data: results, total, page, pageSize });
  } catch (e) {
    return serverErrorResponse('加载书签失败', e);
  }
}

// 打开编辑窗口时，按编号读取单个书签。
export async function getConfigById(env, id) {
  try {
    const result = await env.NAV_DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
    if (!result) return errorResponse('书签不存在', 404);
    return jsonResponse({ code: 200, data: result });
  } catch (e) {
    return serverErrorResponse('加载书签失败', e);
  }
}

// 管理员新增书签时校验必填项并写入数据库。
export async function createConfig(request, env) {
  try {
    const config = await request.json();
    const { name, url, logo, desc, catelog, sort_order } = config;
    const sName = (name || '').trim();
    const sUrl = (url || '').trim();
    const sCatelog = (catelog || '').trim();
    const sLogo = (logo || '').trim() || null;
    const sDesc = (desc || '').trim() || null;
    const sortVal = normalizeSortOrder(sort_order);

    if (!sName || !sUrl || !sCatelog) return errorResponse('名称、网址和分类不能为空', 400);

    const insert = await env.NAV_DB.prepare(
      'INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(sName, sUrl, sLogo, sDesc, sCatelog, sortVal).run();

    return jsonResponse({ code: 201, message: '书签添加成功', insert }, 201);
  } catch (e) {
    return serverErrorResponse('添加书签失败', e);
  }
}

// 管理员保存编辑时，更新对应书签及修改时间。
export async function updateConfig(request, env, id) {
  try {
    const config = await request.json();
    const { name, url, logo, desc, catelog, sort_order } = config;
    const sName = (name || '').trim();
    const sUrl = (url || '').trim();
    const sCatelog = (catelog || '').trim();
    const sLogo = (logo || '').trim() || null;
    const sDesc = (desc || '').trim() || null;
    const sortVal = normalizeSortOrder(sort_order);

    if (!sName || !sUrl || !sCatelog) return errorResponse('名称、网址和分类不能为空', 400);

    const update = await env.NAV_DB.prepare(
      'UPDATE sites SET name = ?, url = ?, logo = ?, desc = ?, catelog = ?, sort_order = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(sName, sUrl, sLogo, sDesc, sCatelog, sortVal, id).run();

    if (!update.meta.changes) return errorResponse('书签不存在', 404);
    return jsonResponse({ code: 200, message: '书签更新成功' });
  } catch (e) {
    return serverErrorResponse('更新书签失败', e);
  }
}

// 管理员确认删除后，按编号删除书签。
export async function deleteConfig(env, id) {
  try {
    const del = await env.NAV_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    if (!del.meta.changes) return errorResponse('书签不存在', 404);
    return jsonResponse({ code: 200, message: '书签删除成功' });
  } catch (e) {
    return serverErrorResponse('删除书签失败', e);
  }
}

// 管理员导入文件时，批量写入书签数组。
export async function importConfig(request, env) {
  try {
    const jsonData = await request.json();
    let sitesToImport = [];

    if (Array.isArray(jsonData)) {
      sitesToImport = jsonData;
    } else if (jsonData && typeof jsonData === 'object' && Array.isArray(jsonData.data)) {
      sitesToImport = jsonData.data;
    } else {
      return errorResponse('导入格式不正确，请提供书签数组或包含 data 数组的对象', 400);
    }

    if (sitesToImport.length === 0) {
      return jsonResponse({ code: 200, message: '文件中没有可导入的书签' });
    }

    const stmts = sitesToImport.map(item => {
      const sName = (item.name || '').trim() || null;
      const sUrl = (item.url || '').trim() || null;
      const sLogo = (item.logo || '').trim() || null;
      const sDesc = (item.desc || '').trim() || null;
      const sCatelog = (item.catelog || '').trim() || null;
      const sortVal = normalizeSortOrder(item.sort_order);
      return env.NAV_DB.prepare(
        'INSERT INTO sites (name, url, logo, desc, catelog, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(sName, sUrl, sLogo, sDesc, sCatelog, sortVal);
    });

    await env.NAV_DB.batch(stmts);
    return jsonResponse({ code: 201, message: `已导入 ${sitesToImport.length} 个书签` }, 201);
  } catch (e) {
    return serverErrorResponse('导入书签失败', e);
  }
}

// 管理员导出时，将全部书签作为文件返回。
export async function exportConfig(env) {
  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC').all();
    return new Response(JSON.stringify(results, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="config.json"',
      },
    });
  } catch (e) {
    return serverErrorResponse('导出书签失败', e);
  }
}
