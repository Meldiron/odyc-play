import { Databases, Users } from 'node-appwrite';
import { json } from '@sveltejs/kit';
import type { Games } from '$lib/appwrite';
import { introspect, serverClient, tokenGrantId, isSameGrant } from '$lib/server/oauth';

// Public, OAuth2-protected API for updating a game's code. Unlike the other
// endpoints, authorization here is fine-grained per game via RFC 9396 Rich
// Authorization Requests (RAR): the access token must carry an
// `authorization_details` entry of type "game" whose identifier matches the
// target game and whose actions include "code.write".

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'PUT, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const CODE_MAX_LENGTH = 1_000_000;

// Validates the Bearer token and, via RFC 9396 Rich Authorization Requests,
// that the token grants `action` on the given game. Returns the user id on
// success, or a ready-to-return error Response.
async function authorizeGameAction(
	request: Request,
	gameId: string,
	action: string
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

	if (!result.sub) {
		return {
			error: json({ message: 'Access token has no subject.' }, { status: 401, headers: CORS })
		};
	}

	const game = await loadGame(gameId);

	// The OAuth2 grant that created the game through this API is implicitly
	// granted every action on what it made, without an explicit grant chosen at
	// consent time — so that one authorization can always come back and manage its
	// game. Scoped to the grant (fails closed when either id is absent), so other
	// tokens the same user grants this app do not inherit the access.
	if (game && isSameGrant(game.creatorGrantId, tokenGrantId(result))) {
		return { userId: result.sub };
	}

	// Otherwise the action must be authorized by an RFC 9396 grant the token
	// carries. A token may carry several `type: 'game'` entries (the consent
	// screen emits one per selected game), so any matching entry that grants the
	// action is enough. We distinguish exact grants from the "*" wildcard ("all
	// games"): exact grants were bound to a game the user owns at consent time,
	// but the wildcard matches whatever id is in the URL, so it must be backed by
	// an ownership check before we trust it — otherwise it would let a token edit
	// games belonging to other users.
	const details = result.authorization_details ?? [];
	const actionable = details.filter(
		(detail) =>
			detail.type === 'game' && Array.isArray(detail.actions) && detail.actions.includes(action)
	);

	const grantedExact = actionable.some((detail) => detail.identifier === gameId);
	const grantedWildcard = actionable.some((detail) => detail.identifier === '*');

	if (!grantedExact && !grantedWildcard) {
		return {
			error: json(
				{ message: `Access token does not grant "${action}" on this game.` },
				{ status: 403, headers: CORS }
			)
		};
	}

	if (!grantedExact && grantedWildcard && !(game && (await userOwnsGame(result.sub, game)))) {
		return {
			error: json(
				{ message: `Access token does not grant "${action}" on this game.` },
				{ status: 403, headers: CORS }
			)
		};
	}

	return { userId: result.sub };
}

// Loads a game by id, or null if it doesn't exist. Used to read the creator
// identity and owner before deciding access; missing games fail closed.
async function loadGame(gameId: string): Promise<Games | null> {
	try {
		const databases = new Databases(serverClient());
		return await databases.getDocument<Games>('main', 'games', gameId);
	} catch {
		return null;
	}
}

// Confirms the user owns the target game, for the wildcard ("*") grant. The
// wildcard means "all games the user owns", which the consent picker enforces
// by only listing owned games; this re-checks it server-side since the token
// itself carries no concrete game id. Returns false on any missing link
// (no profile) so access fails closed.
async function userOwnsGame(userId: string, game: Games): Promise<boolean> {
	try {
		const users = new Users(serverClient());
		const prefs = await users.getPrefs<{ profileId?: string }>(userId);
		return !!prefs.profileId && game.ownerProfileId === prefs.profileId;
	} catch {
		return false;
	}
}

export function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS });
}

export async function PUT({ request, params }) {
	const gameId = params.gameId;
	const auth = await authorizeGameAction(request, gameId, 'code.write');
	if ('error' in auth) {
		return auth.error;
	}

	let body: { code?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Invalid JSON body.' }, { status: 400, headers: CORS });
	}

	const code = body.code;
	if (typeof code !== 'string' || code.length > CODE_MAX_LENGTH) {
		return json(
			{ message: `Field "code" must be a string up to ${CODE_MAX_LENGTH} chars.` },
			{ status: 400, headers: CORS }
		);
	}

	try {
		const databases = new Databases(serverClient());
		const game = await databases.updateDocument<Games>('main', 'games', gameId, { code });

		return json({ game }, { headers: CORS });
	} catch (err: any) {
		return json({ message: err.message }, { status: 400, headers: CORS });
	}
}
