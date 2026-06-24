import { Client, Users } from 'node-appwrite';
import { env } from '$env/dynamic/private';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, OAUTH2_BASE } from '$lib/constants';

// Shared server-only OAuth2 helpers, reused by the MCP server and its OAuth
// discovery/registration/token routes. Mirrors the inline helpers in the other
// /v1 endpoints (introspection + server API key), centralised here because the
// MCP surface spans several files.

export type AuthorizationDetail = {
	type: string;
	identifier?: string;
	actions?: string[];
	locations?: string[];
};

export type Introspection = {
	active: boolean;
	scope?: string;
	sub?: string;
	client_id?: string;
	authorization_details?: AuthorizationDetail[];
};

export function serverClient() {
	return new Client()
		.setEndpoint(APPWRITE_ENDPOINT)
		.setProject(APPWRITE_PROJECT_ID)
		.setKey(env.SSR_APPWRITE_API_KEY ?? '');
}

// RFC 7662 token introspection, authenticated with the server API key.
export async function introspect(token: string): Promise<Introspection | null> {
	const res = await fetch(`${OAUTH2_BASE}/introspect`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'x-appwrite-key': env.SSR_APPWRITE_API_KEY ?? '',
			'x-appwrite-project': APPWRITE_PROJECT_ID ?? ''
		},
		body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString()
	});

	if (!res.ok) {
		return null;
	}

	return (await res.json()) as Introspection;
}

// Resolves the user's active profile document id (stored in their prefs).
export async function getProfileId(userId: string): Promise<string | null> {
	const users = new Users(serverClient());
	const prefs = await users.getPrefs<{ profileId?: string }>(userId);
	return prefs.profileId ?? null;
}

// The space-separated scopes a token carries, as a Set for membership checks.
export function tokenScopes(result: Introspection): Set<string> {
	return new Set((result.scope ?? '').split(' ').filter(Boolean));
}
