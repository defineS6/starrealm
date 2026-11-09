// 接口返回数据时调用，统一状态码与中文内容的编码。
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// 接口校验或执行失败时调用，沿用现有错误响应结构。
export function errorResponse(message, status) {
  return jsonResponse({ code: status, message }, status);
}

// 捕获服务端异常时调用：详细错误只记日志，用户只看到简短提示。
export function serverErrorResponse(message, error) {
  console.error(message, error);
  return errorResponse(message, 500);
}
