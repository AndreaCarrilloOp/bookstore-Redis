const base = (import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE || '')).replace(/\/$/, '');
export const apiBase = base;
export async function callFunction(name, { method = 'GET', body, id } = {}) {
  if (!base) throw new Error('Falta VITE_API_BASE: configura la URL del backend Netlify en Vercel.');
  const url = `${base}/.netlify/functions/${name}${id !== undefined ? '/' + encodeURIComponent(id) : ''}`;
  let response;
  try {
    response = await fetch(url, { method,
      headers: { 'Accept': 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch (error) { throw new Error(`No se logró conectar al backend (${base}): ${error.message}`); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error || (Array.isArray(data?.errors) ? data.errors.join('; ') : '');
    const requestId = response.headers.get('x-nf-request-id');
    throw new Error(detail || `Error HTTP ${response.status}${requestId ? ` (solicitud ${requestId})` : ''}. Revisa la terminal del backend.`);
  }
  return data;
}
