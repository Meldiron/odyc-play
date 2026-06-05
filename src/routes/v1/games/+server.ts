import { Client, Databases, Users, ID, AppwriteException } from 'node-appwrite';
import { env } from '$env/dynamic/private';
import { PUBLIC_ODYC_VERSION } from '$env/static/public';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, OAUTH2_BASE } from '$lib/constants';
import { json } from '@sveltejs/kit';
import slugify from 'slugify';
import friendlyWords from 'friendly-words';
import type { Games } from '$lib/appwrite';

// Public, OAuth2-protected API for creating games on behalf of the authorizing
// user. Access tokens are validated against the OAuth2 introspection endpoint
// using the server API key; the resulting subject is then acted upon with the
// same key.

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const NAME_MAX_LENGTH = 256;
const CODE_MAX_LENGTH = 1_000_000;

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
			'x-appwrite-project': APPWRITE_PROJECT_ID ?? ''
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

function capitalizeFirstLetter(val: string) {
	return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

// Mirrors the web app's generateGametName(): a friendly two-word title.
function generateGameName() {
	const adj = friendlyWords.predicates[Math.floor(Math.random() * friendlyWords.predicates.length)];
	const obj = friendlyWords.objects[Math.floor(Math.random() * friendlyWords.objects.length)];
	return `${capitalizeFirstLetter(adj)} ${capitalizeFirstLetter(obj)}`;
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS });
}

export async function POST({ request }) {
	const auth = await authorize(request, 'games.create');
	if ('error' in auth) {
		return auth.error;
	}

	let body: { name?: unknown; code?: unknown } = {};
	if (request.headers.get('content-length') && request.headers.get('content-length') !== '0') {
		try {
			body = await request.json();
		} catch {
			return json({ message: 'Invalid JSON body.' }, { status: 400, headers: CORS });
		}
	}

	// Name and code are optional; defaults reproduce the web app's "Create game"
	// basic template (a generated name and empty code, which falls back to the
	// default starter game in the editor).
	let name: string;
	if (body.name === undefined || body.name === null) {
		name = generateGameName();
	} else if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > NAME_MAX_LENGTH) {
		return json(
			{ message: `Field "name" must be a non-empty string up to ${NAME_MAX_LENGTH} chars.` },
			{ status: 400, headers: CORS }
		);
	} else {
		name = body.name;
	}

	let code = '';
	if (body.code !== undefined && body.code !== null) {
		if (typeof body.code !== 'string' || body.code.length > CODE_MAX_LENGTH) {
			return json(
				{ message: `Field "code" must be a string up to ${CODE_MAX_LENGTH} chars.` },
				{ status: 400, headers: CORS }
			);
		}
		code = body.code;
	}

	try {
		const profileId = await getProfileId(auth.userId);
		if (!profileId) {
			return json({ message: 'Profile not found.' }, { status: 404, headers: CORS });
		}

		const databases = new Databases(serverClient());
		const game = {
			name,
			slug: slugify(name).toLowerCase(),
			ownerProfileId: profileId,
			code,
			thumbnailFileId: '/screenshot.png',
			version: PUBLIC_ODYC_VERSION ?? 'latest',
			description: null,
			howToPlay: null,
			collaboratorProfileIds: null
		};

		let created: Games;
		try {
			created = await databases.createDocument<Games>('main', 'games', ID.unique(), game);
		} catch (error: unknown) {
			// Slug collides with an existing game document id: fall back to a unique id.
			if (error instanceof AppwriteException && error.code === 409) {
				const id = ID.unique();
				game.slug = id;
				created = await databases.createDocument<Games>('main', 'games', id, game);
			} else {
				throw error;
			}
		}

		return json({ game: created }, { status: 201, headers: CORS });
	} catch (err: any) {
		return json({ message: err.message }, { status: 400, headers: CORS });
	}
}
