// 拼接页面内容时，转义文本以防止其被当作网页代码执行。
export function escapeHTML(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 渲染站点链接和图标前，补全协议并只接受网页链接。
export function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  try {
    const direct = new URL(trimmed);
    if (direct.protocol === 'http:' || direct.protocol === 'https:') return direct.href;
  } catch (_) {
    try {
      const fallback = new URL(`https://${trimmed}`);
      if (fallback.protocol === 'http:' || fallback.protocol === 'https:') return fallback.href;
    } catch (_) {
      return '';
    }
  }
  return '';
}
