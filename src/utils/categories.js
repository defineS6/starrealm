import { normalizeSortOrder } from './sort.js';

// 前台和分类接口加载分类时调用；兼容尚未创建分类排序表的旧数据库。
export async function readCategoryOrders(env) {
  const orders = new Map();
  try {
    const { results } = await env.NAV_DB.prepare('SELECT catelog, sort_order FROM category_orders').all();
    results.forEach(row => orders.set(row.catelog, normalizeSortOrder(row.sort_order)));
  } catch (error) {
    if (!/no such table/i.test(error.message || '')) throw error;
  }
  return orders;
}

// 分类统计完成后调用，合并预建空分类并统一按分类排序、书签排序和名称排列。
export function buildCategoryList(rows, orders) {
  const seen = new Set();
  const categories = rows.map(row => {
    seen.add(row.catelog);
    const fallback = normalizeSortOrder(row.min_site_sort);
    return {
      catelog: row.catelog,
      site_count: row.site_count,
      sort_order: orders.has(row.catelog) ? orders.get(row.catelog) : fallback,
      explicit: orders.has(row.catelog),
      min_site_sort: fallback,
    };
  });

  for (const [catelog, sortOrder] of orders) {
    if (!seen.has(catelog)) {
      categories.push({ catelog, site_count: 0, sort_order: sortOrder, explicit: true, min_site_sort: 9999 });
    }
  }

  return categories.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    if (a.min_site_sort !== b.min_site_sort) return a.min_site_sort - b.min_site_sort;
    return a.catelog.localeCompare(b.catelog, 'zh-Hans-CN', { sensitivity: 'base' });
  });
}
