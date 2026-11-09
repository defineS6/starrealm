import { normalizeSortOrder } from '../utils/sort.js';
import { readCategoryOrders, buildCategoryList } from '../utils/categories.js';
import { errorResponse, jsonResponse, serverErrorResponse } from '../utils/response.js';

/**
 * 获取全部可用分类列表
 * 汇总 sites 表已有站点的分类与 category_orders 中预先创建的分类
 */
export async function getCategories(env) {
  try {
    const categoryOrderMap = await readCategoryOrders(env);
    const { results } = await env.NAV_DB.prepare(
      'SELECT catelog, COUNT(*) AS site_count, MIN(sort_order) AS min_site_sort FROM sites GROUP BY catelog'
    ).all();
    const data = buildCategoryList(results, categoryOrderMap);

    return jsonResponse({ code: 200, data });
  } catch (e) {
    return serverErrorResponse('加载分类失败', e);
  }
}

/**
 * 创建新分类
 * 写入 category_orders，使管理员可预先创建好分类供后续下拉选用
 */
export async function createCategory(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return errorResponse('请求数据格式不正确', 400);
    }

    const rawName = body && (typeof body.catelog === 'string' ? body.catelog : (typeof body.name === 'string' ? body.name : ''));
    const catelog = rawName.trim();

    if (!catelog) {
      return errorResponse('分类名称不能为空', 400);
    }
    if (catelog.length > 50) {
      return errorResponse('分类名称不能超过 50 个字符', 400);
    }
    if (catelog === '.' || catelog === '..') {
      return errorResponse('分类名称不合法', 400);
    }

    const sortVal = normalizeSortOrder(body ? body.sort_order : undefined);

    // 检查是否已存在同名分类（检查 category_orders 和 sites）
    const existingOrder = await env.NAV_DB.prepare(
      'SELECT catelog FROM category_orders WHERE catelog = ?'
    ).bind(catelog).first();

    const existingSite = await env.NAV_DB.prepare(
      'SELECT id FROM sites WHERE catelog = ? LIMIT 1'
    ).bind(catelog).first();

    if (existingOrder || existingSite) {
      return errorResponse('分类已存在，无需重复创建', 409);
    }

    await env.NAV_DB.prepare(
      'INSERT INTO category_orders (catelog, sort_order) VALUES (?, ?)'
    ).bind(catelog, sortVal).run();

    return jsonResponse({
      code: 201,
      message: '分类创建成功',
      data: { catelog, sort_order: sortVal, site_count: 0 }
    }, 201);
  } catch (e) {
    return serverErrorResponse('创建分类失败', e);
  }
}

/**
 * 删除分类
 * 仅允许删除未被任何正式书签或待审核书签引用的空分类
 */
export async function deleteCategory(env, categoryName) {
  try {
    if (typeof categoryName !== 'string') return errorResponse('分类名称不能为空', 400);
    const normalized = categoryName.trim();
    if (!normalized) return errorResponse('分类名称不能为空', 400);

    // 检查正式书签是否引用
    const siteRow = await env.NAV_DB.prepare(
      'SELECT COUNT(*) AS count FROM sites WHERE catelog = ?'
    ).bind(normalized).first();

    if (siteRow && siteRow.count > 0) {
      return errorResponse(`该分类下仍有 ${siteRow.count} 个书签，请先移动或删除对应书签后再删除分类`, 400);
    }

    // 检查待审核书签是否引用
    try {
      const pendingRow = await env.NAV_DB.prepare(
        'SELECT COUNT(*) AS count FROM pending_sites WHERE catelog = ?'
      ).bind(normalized).first();

      if (pendingRow && pendingRow.count > 0) {
        return errorResponse(`该分类仍有 ${pendingRow.count} 个待审核书签，请先处理后再删除分类`, 400);
      }
    } catch (err) {
      if (!/no such table/i.test(err.message || '')) throw err;
    }

    // 执行删除
    const result = await env.NAV_DB.prepare(
      'DELETE FROM category_orders WHERE catelog = ?'
    ).bind(normalized).run();

    if (result.meta && result.meta.changes === 0) {
      return errorResponse('未找到可删除的分类记录', 404);
    }

    return jsonResponse({ code: 200, message: '分类删除成功' });
  } catch (e) {
    return serverErrorResponse('删除分类失败', e);
  }
}

// 管理员保存或重置分类排序时，写入分类排序记录。
export async function updateCategoryOrder(request, env, categoryName) {
  try {
    if (!categoryName) return errorResponse('分类名称不能为空', 400);
    const normalized = categoryName.trim();
    if (!normalized) return errorResponse('分类名称不能为空', 400);

    const body = await request.json();

    // 重置排序时恢复为默认 9999，不删除记录，避免预建空分类丢失
    if (body && body.reset) {
      await env.NAV_DB.prepare(
        'INSERT INTO category_orders (catelog, sort_order) VALUES (?, 9999) ON CONFLICT(catelog) DO UPDATE SET sort_order = 9999'
      ).bind(normalized).run();
      return jsonResponse({ code: 200, message: '分类排序已重置' });
    }

    const sortVal = normalizeSortOrder(body ? body.sort_order : undefined);
    await env.NAV_DB.prepare(
      'INSERT INTO category_orders (catelog, sort_order) VALUES (?, ?) ON CONFLICT(catelog) DO UPDATE SET sort_order = excluded.sort_order'
    ).bind(normalized, sortVal).run();

    return jsonResponse({ code: 200, message: '分类排序已更新' });
  } catch (e) {
    return serverErrorResponse('更新分类排序失败', e);
  }
}
