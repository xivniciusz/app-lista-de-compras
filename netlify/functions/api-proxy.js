// Netlify Function: proxy /api requests to backend FastAPI (comentários em português)
export async function handler(event) {
  const backendBase = (process.env.BACKEND_BASE_URL || '').trim();
  if (!backendBase) {
    return {
      statusCode: 500,
      body: 'Variável BACKEND_BASE_URL não configurada no Netlify',
    };
  }

  const sanitizedBase = backendBase.endsWith('/') ? backendBase.slice(0, -1) : backendBase;
  const requestPath = event.path?.replace(/^\/api/, '') || '';
  const queryString = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const targetUrl = `${sanitizedBase}${requestPath}${queryString}`;

  const headers = { ...event.headers };
  delete headers['host'];
  delete headers['content-length'];

  const init = {
    method: event.httpMethod,
    headers,
    redirect: 'manual',
  };

  if (event.body) {
    init.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
  }

  let backendResponse;
  try {
    backendResponse = await fetch(targetUrl, init);
  } catch (error) {
    return {
      statusCode: 502,
      body: `Erro ao contatar backend: ${error.message}`,
    };
  }

  const responseHeaders = {};
  backendResponse.headers.forEach((value, key) => {
    // Evita sobrescrever cabeçalhos sensíveis do Netlify
    if (key.toLowerCase() === 'content-length') return;
    if (key.toLowerCase() === 'content-encoding') return;
    if (key.toLowerCase() === 'transfer-encoding') return;
    responseHeaders[key] = value;
  });

  const isBinary = responseHeaders['content-type']?.startsWith('application/octet-stream');
  const bodyBuffer = Buffer.from(await backendResponse.arrayBuffer());

  return {
    statusCode: backendResponse.status,
    headers: responseHeaders,
    body: isBinary ? bodyBuffer.toString('base64') : bodyBuffer.toString('utf-8'),
    isBase64Encoded: isBinary,
  };
}
