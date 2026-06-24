import type { Handle } from '@sveltejs/kit';

// OAuth 2.1 discovery documents for the MCP server. Served from the `handle`
// hook rather than as routes because SvelteKit's filesystem router ignores
// dot-prefixed directories like `.well-known`.
//
// The flow they advertise:
//   • Protected Resource Metadata (RFC 9728) names this app as the auth server
//     for the /v1/mcp resource.
//   • Authorization Server Metadata (RFC 8414) points clients at the existing
//     /consent screen (authorization), a token-exchange proxy, and a Dynamic
//     Client Registration endpoint (RFC 7591) so hosts like Cursor and Claude
//     can self-register without a manually created client.

// Only scopes registered in the Appwrite Console can be requested, or authorize
// fails with `invalid_scope`. `games.create` is the one registered games scope,
// and the MCP tools accept it for read/create/update alike (see mcp.ts).
const MCP_SCOPES = ['openid', 'games.create'];

const METADATA_CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version'
};

function metadataResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { ...METADATA_CORS, 'Content-Type': 'application/json' }
	});
}

function protectedResourceMetadata(origin: string) {
	return {
		resource: `${origin}/v1/mcp`,
		authorization_servers: [origin],
		scopes_supported: MCP_SCOPES,
		bearer_methods_supported: ['header'],
		resource_name: 'Odyc Play MCP'
	};
}

function authorizationServerMetadata(origin: string) {
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/v1/mcp/oauth/authorize`,
		token_endpoint: `${origin}/v1/mcp/oauth/token`,
		registration_endpoint: `${origin}/v1/mcp/oauth/register`,
		scopes_supported: MCP_SCOPES,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
		service_documentation: `${origin}/v1/mcp`
	};
}

// Match a well-known path, tolerating an optional resource path suffix (e.g.
// `/.well-known/oauth-protected-resource/v1/mcp`) that RFC 9728/8414 clients
// append to scope discovery to a specific resource.
function matchesWellKnown(pathname: string, name: string): boolean {
	return pathname === `/.well-known/${name}` || pathname.startsWith(`/.well-known/${name}/`);
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (pathname.startsWith('/.well-known/')) {
		if (event.request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: METADATA_CORS });
		}

		const origin = event.url.origin;

		if (matchesWellKnown(pathname, 'oauth-protected-resource')) {
			return metadataResponse(protectedResourceMetadata(origin));
		}

		// `oauth-authorization-server` is the RFC 8414 name; `openid-configuration`
		// is the OIDC discovery alias some clients probe first.
		if (
			matchesWellKnown(pathname, 'oauth-authorization-server') ||
			matchesWellKnown(pathname, 'openid-configuration')
		) {
			return metadataResponse(authorizationServerMetadata(origin));
		}
	}

	// Re-apply SvelteKit's form CSRF protection ourselves (we disabled the global
	// one in svelte.config.js so the OAuth token endpoint can accept cross-origin
	// form posts). It guards cookie-driven form submissions, which only the page
	// routes could ever have — the stateless, Bearer-authenticated /v1 and /api
	// endpoints are meant to be called cross-origin, so they're exempt.
	if (isForbiddenCrossSiteForm(event.request, event.url, pathname)) {
		return new Response('Cross-site form submissions are forbidden', {
			status: 403,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	return resolve(event);
};

const FORM_CONTENT_TYPES = [
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain'
];

function isForbiddenCrossSiteForm(request: Request, url: URL, pathname: string): boolean {
	const method = request.method;
	if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
		return false;
	}
	// Stateless cross-origin APIs are exempt — they authorize via Bearer tokens,
	// not ambient cookies, so CSRF doesn't apply.
	if (pathname.startsWith('/v1/') || pathname.startsWith('/api/')) {
		return false;
	}
	const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!FORM_CONTENT_TYPES.includes(contentType)) {
		return false;
	}
	return request.headers.get('origin') !== url.origin;
}
