import { type Models } from 'appwrite';

// Auto-generated using `appwrite types -l ts ./src/lib`

export type Feedback = Models.Document & {
	fileId: string | null;
	text: string;
};

export type Games = Models.Document & {
	name: string;
	thumbnailFileId: string | null;
	ownerProfileId: string;
	description: string | null;
	howToPlay: string | null;
	slug: string;
	collaboratorProfileIds: string[] | null;
	code: string | null;
	version: string;
	// The OAuth2 grant (authorization) that created the game through the public
	// API/MCP, or null for games created in the web app. That single grant is
	// implicitly granted every RFC 9396 action on the game it made — scoped to
	// the authorization, not the user, so other tokens the same user grants this
	// app do not inherit edit access.
	creatorGrantId: string | null;
};

export type CommunityHighlights = Models.Document & {
	gameId: string;
};

export type Profiles = Models.Document & {
	name: string;
	avatarPixels: string | null;
	description: string | null;
	userId: string;
};
