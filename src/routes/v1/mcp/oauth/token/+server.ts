import { OAUTH2_BASE } from '$lib/constants';

// Thin proxy in front of the Appwrite OAuth2 token endpoint, giving MCP hosts a
// same-origin `token_endpoint` (advertised in our discovery metadata).
//
// The request body is forwarded verbatim — a bare form POST, exactly what the
// Odyc CLI sends to this endpoint (and which works). The project is already in
// the URL path, so no extra headers. SvelteKit's cross-origin form CSRF guard,
// which used to block this before the handler even ran, is disabled globally and
// re-applied for non-API routes only (see svelte.config.js + hooks.server.ts).

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

export function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS });
}

// Appwrite returns errors as `{ "message": "…" }`, but OAuth clients expect the
// RFC 6749 `{ "error": "…", "error_description": "…" }` shape and choke (ZodError)
// when `error` is absent. Rewrite error bodies that lack an `error` field.
function normalizeErrorBody(raw: string, status: number): string {
	if (status < 400) return raw;
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && !('error' in parsed)) {
			return JSON.stringify({
				error: status === 401 || status === 403 ? 'invalid_client' : 'invalid_request',
				error_description: parsed.message ?? `Token endpoint returned status ${status}.`
			});
		}
	} catch {
		return JSON.stringify({
			error: 'invalid_request',
			error_description: `Token endpoint returned status ${status}.`
		});
	}
	return raw;
}

export async function POST({ request }) {
	const bodyText = await request.text();
	const contentType = request.headers.get('content-type') ?? 'application/x-www-form-urlencoded';

	// Temporary diagnostics — confirms the handler is reached and shows Appwrite's
	// verbatim response. Safe to remove once the flow is verified.
	console.log('[mcp/token] incoming', { contentType, bodyLength: bodyText.length });

	let upstream: Response;
	try {
		upstream = await fetch(`${OAUTH2_BASE}/token`, {
			method: 'POST',
			headers: { 'Content-Type': contentType },
			body: bodyText
		});
	} catch (e) {
		console.error('[mcp/token] upstream fetch failed', e);
		return new Response(
			JSON.stringify({ error: 'server_error', error_description: 'Token endpoint unreachable.' }),
			{ status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
		);
	}

	const raw = await upstream.text();
	console.log('[mcp/token] upstream response', { status: upstream.status, body: raw.slice(0, 800) });

	return new Response(normalizeErrorBody(raw, upstream.status), {
		status: upstream.status,
		headers: {
			...CORS,
			'Content-Type': 'application/json',
			// Token responses must never be cached (RFC 6749 §5.1).
			'Cache-Control': 'no-store',
			Pragma: 'no-cache'
		}
	});
}
