import { introspect, tokenScopes } from '$lib/server/oauth';
import {
	handleRpcMessage,
	rpcErrors,
	type JsonRpcResponse,
	type McpContext
} from '$lib/server/mcp';

// Model Context Protocol endpoint for Odyc Play, served over the Streamable HTTP
// transport (a single POST carrying one JSON-RPC message, answered with one JSON
// response). Authorization reuses the project's OAuth2 access tokens: the Bearer
// token is introspected (RFC 7662) and its scopes gate each tool.
//
// Clients that don't yet have a token receive a 401 with a `WWW-Authenticate`
// header pointing at our Protected Resource Metadata (RFC 9728), which kicks off
// the OAuth2 flow advertised under /.well-known.

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version',
	'Access-Control-Expose-Headers': 'WWW-Authenticate'
};

function resourceMetadataUrl(url: URL): string {
	return `${url.origin}/.well-known/oauth-protected-resource/v1/mcp`;
}

// RFC 6750 / RFC 9728 challenge that tells MCP clients where to discover the
// authorization server and begin the OAuth2 flow.
function unauthorized(url: URL, description: string): Response {
	return new Response(JSON.stringify({ error: 'invalid_token', error_description: description }), {
		status: 401,
		headers: {
			...CORS,
			'Content-Type': 'application/json',
			'WWW-Authenticate': `Bearer error="invalid_token", error_description="${description}", resource_metadata="${resourceMetadataUrl(url)}"`
		}
	});
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS });
}

// The Streamable HTTP transport opens a GET for a server-pushed SSE stream. We
// are stateless and never push, so we decline it (clients fall back to plain
// request/response over POST, which is all our tools need).
export function GET() {
	return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
		status: 405,
		headers: { ...CORS, 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' }
	});
}

export async function POST({ request, url }) {
	const header = request.headers.get('authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) {
		return unauthorized(url, 'Missing or invalid Authorization header.');
	}

	const result = await introspect(match[1].trim());
	if (!result || !result.active || !result.sub) {
		return unauthorized(url, 'Invalid or expired access token.');
	}

	const ctx: McpContext = {
		userId: result.sub,
		scopes: tokenScopes(result),
		authorizationDetails: result.authorization_details ?? [],
		origin: url.origin
	};

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return jsonRpc(rpcErrors.parse());
	}

	// MCP 2025-06-18 dropped JSON-RPC batching, but older clients may still send
	// an array. Support both: process each message, drop notification nulls.
	if (Array.isArray(payload)) {
		if (payload.length === 0) {
			return jsonRpc(rpcErrors.invalid());
		}
		const responses = (
			await Promise.all(payload.map((message) => handleRpcMessage(message, ctx)))
		).filter((r): r is JsonRpcResponse => r !== null);
		// An all-notification batch yields no responses → 202 Accepted, no body.
		if (responses.length === 0) {
			return new Response(null, { status: 202, headers: CORS });
		}
		return jsonRpc(responses);
	}

	const response = await handleRpcMessage(payload, ctx);
	if (response === null) {
		// A lone notification (e.g. notifications/initialized) gets no body.
		return new Response(null, { status: 202, headers: CORS });
	}
	return jsonRpc(response);
}

function jsonRpc(body: JsonRpcResponse | JsonRpcResponse[]): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { ...CORS, 'Content-Type': 'application/json' }
	});
}
