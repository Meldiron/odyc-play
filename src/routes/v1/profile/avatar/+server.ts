import { Client, Databases, Users } from 'node-appwrite';
import { env } from '$env/dynamic/private';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, OAUTH2_BASE } from '$lib/constants';
import { json } from '@sveltejs/kit';
import type { Profiles } from '$lib/appwrite';

// Public, OAuth2-protected API for reading and updating the authorizing user's
// avatar. Access tokens are validated against the OAuth2 introspection endpoint
// using the server API key; the resulting subject is then acted upon with the
// same key.

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const AVATAR_MAX_LENGTH = 4096;

type Introspection = {
	active: boolean;
	scope?: string;
	sub?: string;
	client_id?: string;
};

function serverClient() {
	return new Client()
		.setEndpoint(APPWRITE_ENDPOINT)
		.setProject(APPWRITE_PROJECT_ID)
		.setKey(env.SSR_APPWRITE_API_KEY ?? '');
}

// RFC 7662 token introspection, authenticated with the server API key.
async function introspect(token: string): Promise<Introspection | null> {
	const res = await fetch(`${OAUTH2_BASE}/introspect`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
      'x-appwrite-key': env.SSR_APPWRITE_API_KEY ?? '',
			'x-appwrite-project': APPWRITE_PROJECT_ID ?? '',
		},
		body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString()
	});

	if (!res.ok) {
		return null;
	}

	return (await res.json()) as Introspection;
}

// Validates the Bearer token and required scope. Returns the user id on success,
// or a ready-to-return error Response.
async function authorize(
	request: Request,
	requiredScope: string
): Promise<{ userId: string } | { error: Response }> {
	const header = request.headers.get('authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) {
		return {
			error: json(
				{ message: 'Missing or invalid Authorization header.' },
				{ status: 401, headers: CORS }
			)
		};
	}

	const result = await introspect(match[1].trim());
	if (!result || !result.active) {
		return {
			error: json({ message: 'Invalid or expired access token.' }, { status: 401, headers: CORS })
		};
	}

	const scopes = (result.scope ?? '').split(' ').filter(Boolean);
	if (!scopes.includes(requiredScope)) {
		return {
			error: json(
				{ message: `Missing required scope: ${requiredScope}.` },
				{ status: 403, headers: CORS }
			)
		};
	}

	if (!result.sub) {
		return {
			error: json({ message: 'Access token has no subject.' }, { status: 401, headers: CORS })
		};
	}

	return { userId: result.sub };
}

// Resolves the user's active profile document id (stored in their prefs).
async function getProfileId(userId: string): Promise<string | null> {
	const users = new Users(serverClient());
	const prefs = await users.getPrefs<{ profileId?: string }>(userId);
	return prefs.profileId ?? null;
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS });
}

export async function GET({ request }) {
	const auth = await authorize(request, 'profile.read');
	if ('error' in auth) {
		return auth.error;
	}

	try {
		const profileId = await getProfileId(auth.userId);
		if (!profileId) {
			return json({ message: 'Profile not found.' }, { status: 404, headers: CORS });
		}

		const databases = new Databases(serverClient());
		const profile = await databases.getDocument<Profiles>('main', 'profiles', profileId);

		return json({ avatar: profile.avatarPixels }, { headers: CORS });
	} catch (err: any) {
		return json({ message: err.message }, { status: 400, headers: CORS });
	}
}

export async function PUT({ request }) {
	const auth = await authorize(request, 'profile.write');
	if ('error' in auth) {
		return auth.error;
	}

	let body: { avatar?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Invalid JSON body.' }, { status: 400, headers: CORS });
	}

	const avatar = body.avatar;
	if (typeof avatar !== 'string' || avatar.length === 0 || avatar.length > AVATAR_MAX_LENGTH) {
		return json(
			{ message: `Field "avatar" must be a non-empty string up to ${AVATAR_MAX_LENGTH} chars.` },
			{ status: 400, headers: CORS }
		);
	}

	try {
		const profileId = await getProfileId(auth.userId);
		if (!profileId) {
			return json({ message: 'Profile not found.' }, { status: 404, headers: CORS });
		}

		const databases = new Databases(serverClient());
		const profile = await databases.updateDocument<Profiles>('main', 'profiles', profileId, {
			avatarPixels: avatar
		});

		return json({ avatar: profile.avatarPixels }, { headers: CORS });
	} catch (err: any) {
		return json({ message: err.message }, { status: 400, headers: CORS });
	}
}
