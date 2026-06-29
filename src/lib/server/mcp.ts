import { Databases, ID, Permission, Role, Query, AppwriteException } from 'node-appwrite';
import { PUBLIC_ODYC_VERSION } from '$env/static/public';
import slugify from 'slugify';
import friendlyWords from 'friendly-words';
import type { Games } from '$lib/appwrite';
import { serverClient, getProfileId, isSameGrant, type AuthorizationDetail } from '$lib/server/oauth';

// Model Context Protocol server for Odyc Play. Implements the JSON-RPC methods a
// host (Claude, Cursor, …) needs to discover and call tools over the Streamable
// HTTP transport. The transport, auth and HTTP plumbing live in the +server.ts;
// this module owns the protocol semantics and the tool implementations.

export const SERVER_NAME = 'Odyc Play';
export const SERVER_VERSION = '1.0.0';

// Protocol revisions we know how to speak. We echo the client's requested
// version when we support it, otherwise we offer our newest.
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

const NAME_MAX_LENGTH = 256;
const CODE_MAX_LENGTH = 1_000_000;
const LIST_MAX_LIMIT = 100;

// JSON-RPC 2.0 error codes (plus a couple of conventional ones).
const RPC_PARSE_ERROR = -32700;
const RPC_INVALID_REQUEST = -32600;
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INVALID_PARAMS = -32602;
const RPC_INTERNAL_ERROR = -32603;

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
	jsonrpc: '2.0';
	id?: JsonRpcId;
	method: string;
	params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
	jsonrpc: '2.0';
	id: JsonRpcId;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
};

// What the transport knows about the caller after introspecting the token.
export type McpContext = {
	userId: string;
	// The token's OAuth2 grant id (or null if the token carries no per-grant
	// claim). Used to recognise the authorization that created a game, so only
	// that grant — not every token the user issues this app — keeps implicit
	// edit access. Null fails closed.
	grantId: string | null;
	scopes: Set<string>;
	// RFC 9396 grants carried by the token (e.g. `code.write` on chosen games).
	authorizationDetails: AuthorizationDetail[];
	origin: string;
};

// ── Tool catalogue ──────────────────────────────────────────────────────────

type ToolDef = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	// Scopes accepted for this tool — any one is sufficient. Read/write tools also
	// accept `games.create` so a single granted scope can manage a user's games.
	scopes: string[];
};

const TOOLS: ToolDef[] = [
	{
		name: 'list_games',
		description:
			'List the games owned by the authenticated user. Returns each game id, name, slug, description, Odyc version and its public URL.',
		inputSchema: {
			type: 'object',
			properties: {
				limit: {
					type: 'integer',
					minimum: 1,
					maximum: LIST_MAX_LIMIT,
					description: `Maximum number of games to return (default ${LIST_MAX_LIMIT}).`
				}
			},
			additionalProperties: false
		},
		scopes: ['games.read', 'games.create']
	},
	{
		name: 'get_game',
		description:
			"Get a single game the user owns or collaborates on, including its full Odyc source code. Use this to read a game's code before editing it.",
		inputSchema: {
			type: 'object',
			properties: {
				gameId: { type: 'string', description: 'The game document id.' }
			},
			required: ['gameId'],
			additionalProperties: false
		},
		scopes: ['games.read', 'games.create']
	},
	{
		name: 'create_game',
		description:
			'Create a new Odyc game on behalf of the user. Both fields are optional: a friendly name is generated when omitted, and an empty code falls back to the default starter game. Returns the created game with its id and public URL.',
		inputSchema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					maxLength: NAME_MAX_LENGTH,
					description: 'Display name of the game.'
				},
				code: {
					type: 'string',
					maxLength: CODE_MAX_LENGTH,
					description: 'Odyc.js source code for the game.'
				}
			},
			additionalProperties: false
		},
		scopes: ['games.create']
	},
	{
		name: 'update_game_code',
		description:
			"Replace the Odyc source code of a game the user owns. Read the game first with get_game if you need its current code. Requires the user to have authorized code edits for this game during sign-in.",
		inputSchema: {
			type: 'object',
			properties: {
				gameId: { type: 'string', description: 'The game document id.' },
				code: {
					type: 'string',
					maxLength: CODE_MAX_LENGTH,
					description: 'The new Odyc.js source code.'
				}
			},
			required: ['gameId', 'code'],
			additionalProperties: false
		},
		// Authorized via the RFC 9396 `code.write` grant rather than a scope (the
		// grant is bound to specific games at consent time), so no scope gate here.
		scopes: []
	}
];

export function listTools() {
	return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

// ── Tool execution ──────────────────────────────────────────────────────────

// A tool either succeeds with a structured payload or fails with a message that
// is surfaced to the model as an `isError` tool result (recoverable), as opposed
// to a protocol-level JSON-RPC error.
class ToolError extends Error {}

function capitalizeFirstLetter(val: string) {
	return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

// Mirrors the web app's generateGameName(): a friendly two-word title.
function generateGameName() {
	const adj = friendlyWords.predicates[Math.floor(Math.random() * friendlyWords.predicates.length)];
	const obj = friendlyWords.objects[Math.floor(Math.random() * friendlyWords.objects.length)];
	return `${capitalizeFirstLetter(adj)} ${capitalizeFirstLetter(obj)}`;
}

// Shape returned to the model for a game. Keeps the payload focused on what an
// agent needs; `code` is included only by get_game.
function serializeGame(game: Games, origin: string, includeCode: boolean) {
	const base: Record<string, unknown> = {
		id: game.$id,
		name: game.name,
		slug: game.slug,
		description: game.description,
		howToPlay: game.howToPlay,
		version: game.version,
		url: `${origin}/g/${game.slug}`,
		updatedAt: game.$updatedAt
	};
	if (includeCode) base.code = game.code ?? '';
	return base;
}

async function requireProfileId(userId: string): Promise<string> {
	const profileId = await getProfileId(userId);
	if (!profileId) throw new ToolError('No profile is associated with this account.');
	return profileId;
}

async function toolListGames(args: Record<string, unknown>, ctx: McpContext) {
	const profileId = await requireProfileId(ctx.userId);

	let limit = LIST_MAX_LIMIT;
	if (args.limit !== undefined) {
		if (typeof args.limit !== 'number' || !Number.isInteger(args.limit) || args.limit < 1) {
			throw new ToolError('"limit" must be a positive integer.');
		}
		limit = Math.min(args.limit, LIST_MAX_LIMIT);
	}

	const databases = new Databases(serverClient());
	const result = await databases.listDocuments<Games>('main', 'games', [
		Query.equal('ownerProfileId', profileId),
		Query.orderDesc('$updatedAt'),
		Query.limit(limit)
	]);

	return {
		total: result.total,
		games: result.documents.map((game) => serializeGame(game, ctx.origin, false))
	};
}

// Reads a game the caller may access: owned games, plus games they collaborate
// on. Fails closed (not-found) otherwise so we never leak another user's game.
async function loadAccessibleGame(gameId: string, profileId: string): Promise<Games> {
	const databases = new Databases(serverClient());
	let game: Games;
	try {
		game = await databases.getDocument<Games>('main', 'games', gameId);
	} catch {
		throw new ToolError(`Game "${gameId}" was not found.`);
	}

	const isOwner = game.ownerProfileId === profileId;
	const isCollaborator = (game.collaboratorProfileIds ?? []).includes(profileId);
	if (!isOwner && !isCollaborator) {
		throw new ToolError(`Game "${gameId}" was not found.`);
	}
	return game;
}

async function toolGetGame(args: Record<string, unknown>, ctx: McpContext) {
	if (typeof args.gameId !== 'string' || args.gameId.length === 0) {
		throw new ToolError('"gameId" is required.');
	}
	const profileId = await requireProfileId(ctx.userId);
	const game = await loadAccessibleGame(args.gameId, profileId);
	return { game: serializeGame(game, ctx.origin, true) };
}

async function toolCreateGame(args: Record<string, unknown>, ctx: McpContext) {
	const profileId = await requireProfileId(ctx.userId);

	let name: string;
	if (args.name === undefined || args.name === null) {
		name = generateGameName();
	} else if (
		typeof args.name !== 'string' ||
		args.name.length === 0 ||
		args.name.length > NAME_MAX_LENGTH
	) {
		throw new ToolError(`"name" must be a non-empty string up to ${NAME_MAX_LENGTH} chars.`);
	} else {
		name = args.name;
	}

	let code = '';
	if (args.code !== undefined && args.code !== null) {
		if (typeof args.code !== 'string' || args.code.length > CODE_MAX_LENGTH) {
			throw new ToolError(`"code" must be a string up to ${CODE_MAX_LENGTH} chars.`);
		}
		code = args.code;
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
		collaboratorProfileIds: null,
		// Record the OAuth2 grant that created this game, so this one authorization
		// can later edit its code without an explicit per-game code.write grant.
		// Other tokens the same user grants this app get a different grant id and so
		// do not inherit that access.
		creatorGrantId: ctx.grantId
	};

	// Grant the authorizing user read/update/delete on their own game.
	const permissions = [
		Permission.read(Role.user(ctx.userId)),
		Permission.update(Role.user(ctx.userId)),
		Permission.delete(Role.user(ctx.userId))
	];

	let created: Games;
	try {
		created = await databases.createDocument<Games>('main', 'games', ID.unique(), game, permissions);
	} catch (error: unknown) {
		// Slug collides with an existing game document id: fall back to a unique id.
		if (error instanceof AppwriteException && error.code === 409) {
			const id = ID.unique();
			game.slug = id;
			created = await databases.createDocument<Games>('main', 'games', id, game, permissions);
		} else {
			throw error;
		}
	}

	return { game: serializeGame(created, ctx.origin, true) };
}

// RFC 9396: does the token grant `code.write` on this game? A grant is either
// exact (the consent picker bound this game id) or the `*` wildcard ("all
// games"). The wildcard is only trusted behind an ownership check, since it
// matches whatever id is asked for — mirroring the REST code endpoint.
function codeWriteGrant(details: AuthorizationDetail[], gameId: string) {
	const actionable = details.filter(
		(detail) =>
			detail.type === 'game' &&
			Array.isArray(detail.actions) &&
			detail.actions.includes('code.write')
	);
	return {
		exact: actionable.some((detail) => detail.identifier === gameId),
		wildcard: actionable.some((detail) => detail.identifier === '*')
	};
}

async function toolUpdateGameCode(args: Record<string, unknown>, ctx: McpContext) {
	if (typeof args.gameId !== 'string' || args.gameId.length === 0) {
		throw new ToolError('"gameId" is required.');
	}
	if (typeof args.code !== 'string' || args.code.length > CODE_MAX_LENGTH) {
		throw new ToolError(`"code" must be a string up to ${CODE_MAX_LENGTH} chars.`);
	}

	const profileId = await requireProfileId(ctx.userId);
	const existing = await loadAccessibleGame(args.gameId, profileId);

	// The OAuth2 grant that created the game through this API is implicitly
	// granted every RFC 9396 action on what it made, so that one authorization can
	// keep editing the game without re-consenting per game. Any other caller —
	// including a different token from the same user — must carry an explicit
	// `code.write` grant for this game (exact, or the trusted `*` wildcard).
	if (!isSameGrant(existing.creatorGrantId, ctx.grantId)) {
		const { exact, wildcard } = codeWriteGrant(ctx.authorizationDetails, args.gameId);
		if (!exact && !wildcard) {
			throw new ToolError(
				'The access token does not authorize editing this game. Re-authorize and grant code access to it (or to all games).'
			);
		}
	}

	// code.write is owner-only; collaborators can read via get_game but not deploy.
	// This also backs the `*` wildcard grant, which is only trusted once we've
	// confirmed the caller owns this specific game.
	if (existing.ownerProfileId !== profileId) {
		throw new ToolError('Only the game owner can update its code.');
	}

	const databases = new Databases(serverClient());
	const game = await databases.updateDocument<Games>('main', 'games', args.gameId, {
		code: args.code
	});

	return { game: serializeGame(game, ctx.origin, true) };
}

const TOOL_RUNNERS: Record<
	string,
	(args: Record<string, unknown>, ctx: McpContext) => Promise<unknown>
> = {
	list_games: toolListGames,
	get_game: toolGetGame,
	create_game: toolCreateGame,
	update_game_code: toolUpdateGameCode
};

// ── JSON-RPC dispatch ─────────────────────────────────────────────────────────

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
	return { jsonrpc: '2.0', id, result };
}

function err(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
	return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

function negotiateProtocolVersion(params: Record<string, unknown> | undefined): string {
	const requested = params?.protocolVersion;
	if (typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) {
		return requested;
	}
	return LATEST_PROTOCOL_VERSION;
}

// Handles one JSON-RPC message. Returns a response object, or `null` for
// notifications (messages without an `id`), which get no reply.
export async function handleRpcMessage(
	message: unknown,
	ctx: McpContext
): Promise<JsonRpcResponse | null> {
	if (typeof message !== 'object' || message === null) {
		return err(null, RPC_INVALID_REQUEST, 'Invalid Request.');
	}

	const { id = null, method, params } = message as JsonRpcRequest;
	const isNotification = (message as JsonRpcRequest).id === undefined;

	if (typeof method !== 'string') {
		return isNotification ? null : err(id, RPC_INVALID_REQUEST, 'Missing method.');
	}

	// Notifications (initialized, cancelled, …) require no response.
	if (isNotification) {
		return null;
	}

	switch (method) {
		case 'initialize':
			return ok(id, {
				protocolVersion: negotiateProtocolVersion(params),
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
				instructions:
					'Use list_games and get_game to read the user\'s Odyc games and their code, create_game to make new games, and update_game_code to edit them.'
			});

		case 'ping':
			return ok(id, {});

		case 'tools/list':
			return ok(id, { tools: listTools() });

		case 'tools/call':
			return handleToolCall(id, params, ctx);

		default:
			return err(id, RPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
	}
}

async function handleToolCall(
	id: JsonRpcId,
	params: Record<string, unknown> | undefined,
	ctx: McpContext
): Promise<JsonRpcResponse> {
	const name = params?.name;
	if (typeof name !== 'string') {
		return err(id, RPC_INVALID_PARAMS, 'Tool name is required.');
	}

	const def = TOOLS.find((t) => t.name === name);
	const runner = TOOL_RUNNERS[name];
	if (!def || !runner) {
		return err(id, RPC_METHOD_NOT_FOUND, `Unknown tool: ${name}`);
	}

	// Enforce the OAuth scopes the tool requires (any one is sufficient). Tools
	// with no scope listed authorize another way (e.g. update_game_code uses the
	// RFC 9396 code.write grant, checked inside the tool).
	if (def.scopes.length > 0 && !def.scopes.some((scope) => ctx.scopes.has(scope))) {
		return toolError(id, `This action requires one of the scopes: ${def.scopes.join(', ')}.`);
	}

	const args = (params?.arguments as Record<string, unknown>) ?? {};

	try {
		const result = await runner(args, ctx);
		return ok(id, toolSuccess(result));
	} catch (error: unknown) {
		if (error instanceof ToolError) {
			return toolError(id, error.message);
		}
		if (error instanceof AppwriteException) {
			return toolError(id, error.message);
		}
		return err(id, RPC_INTERNAL_ERROR, 'Internal error while executing the tool.');
	}
}

// MCP tool results carry human/agent-readable `content` plus optional
// `structuredContent`. We return both: the JSON text (broadest client support)
// and the structured object.
function toolSuccess(result: unknown) {
	return {
		content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
		structuredContent: result as Record<string, unknown>,
		isError: false
	};
}

function toolError(id: JsonRpcId, message: string): JsonRpcResponse {
	return ok(id, {
		content: [{ type: 'text', text: message }],
		isError: true
	});
}

export const rpcErrors = {
	parse: (id: JsonRpcId = null) => err(id, RPC_PARSE_ERROR, 'Parse error.'),
	invalid: (id: JsonRpcId = null) => err(id, RPC_INVALID_REQUEST, 'Invalid Request.')
};
