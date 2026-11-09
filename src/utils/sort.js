// 读取或保存排序时，统一默认值并限制为数据库整数范围。
export function normalizeSortOrder(value) {
  if (value === undefined || value === null || value === '') return 9999;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.max(-2147483648, Math.min(2147483647, Math.round(parsed)));
  }
  return 9999;
}
