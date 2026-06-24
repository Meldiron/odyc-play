import { Apps, ID } from 'node-appwrite';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { serverClient } from '$lib/server/oauth';

// RFC 7591 Dynamic Client Registration. MCP hosts (Cursor, Claude, …) post their
// redirect URIs here and get back a `client_id` for the OAuth2 authorization
// code + PKCE flow.
//
// Two modes:
//   • Shared client (preferred) — set MCP_OAUTH_CLIENT_ID to a single `public`
//     OAuth app you create once in the Appwrite console. Every host shares it; we
//     just echo that id back. No `apps.write` on the server key, and no per-client
//     app spam. The catch: each host's redirect URI must be on that app's
//     allowlist (e.g. Claude's `https://claude.ai/api/mcp/auth_callback`).
//   • Dynamic registration (fallback) — when no shared id is configured, mint a
//     fresh `public` Appwrite OAuth app per client, registering its exact redirect
//     URIs automatically. Requires the server key to hold `apps.write`.

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const CLIENT_NAME_MAX_LENGTH = 256;
const MAX_REDIRECT_URIS = 10;

type RegistrationRequest = {
	redirect_uris?: unknown;
	client_name?: unknown;
	grant_types?: unknown;
	response_types?: unknown;
	token_endpoint_auth_method?: unknown;
	scope?: unknown;
};

function registrationError(error: string, description: string, status = 400) {
	return json({ error, error_description: description }, { status, headers: CORS });
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS });
}

export async function POST({ request }) {
	let body: RegistrationRequest;
	try {
		body = await request.json();
	} catch {
		return registrationError('invalid_client_metadata', 'Request body must be valid JSON.');
	}

	// redirect_uris is the one required field for the authorization code flow.
	if (
		!Array.isArray(body.redirect_uris) ||
		body.redirect_uris.length === 0 ||
		body.redirect_uris.length > MAX_REDIRECT_URIS ||
		!body.redirect_uris.every((uri) => typeof uri === 'string' && uri.length > 0)
	) {
		return registrationError(
			'invalid_redirect_uri',
			`"redirect_uris" must be a non-empty array of up to ${MAX_REDIRECT_URIS} URI strings.`
		);
	}
	const redirectUris = body.redirect_uris as string[];

	let clientName = 'MCP Client';
	if (typeof body.client_name === 'string' && body.client_name.length > 0) {
		clientName = body.client_name.slice(0, CLIENT_NAME_MAX_LENGTH);
	}

	function clientInfo(clientId: string) {
		// RFC 7591 §3.2.1 client information response. Public client → no secret.
		return {
			client_id: clientId,
			client_id_issued_at: Math.floor(Date.now() / 1000),
			redirect_uris: redirectUris,
			client_name: clientName,
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			scope: 'openid games.create'
		};
	}

	// Shared-client mode: hand back the pre-created app id without touching the
	// Apps API, so the server key needs no `apps.write`.
	const sharedClientId = env.MCP_OAUTH_CLIENT_ID;
	if (sharedClientId) {
		return json(clientInfo(sharedClientId), { status: 201, headers: CORS });
	}

	// Dynamic registration: mint a per-client `public` app with its exact redirect
	// URIs. Requires `apps.write` on the server key.
	try {
		const apps = new Apps(serverClient());
		const app = await apps.create({
			appId: ID.unique(),
			name: clientName,
			redirectUris,
			enabled: true,
			type: 'public'
		});

		return json(clientInfo(app.$id), { status: 201, headers: CORS });
	} catch (err: any) {
		// Most likely the server API key lacks permission to manage OAuth apps.
		// Set MCP_OAUTH_CLIENT_ID to switch to shared-client mode instead.
		return registrationError(
			'invalid_client_metadata',
			err?.message ?? 'Failed to register the client.',
			500
		);
	}
}
