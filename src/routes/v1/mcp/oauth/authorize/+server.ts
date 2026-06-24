import { redirect } from '@sveltejs/kit';

// Authorization endpoint advertised to MCP hosts. They only know how to request
// scopes, but Odyc gates code edits with an RFC 9396 Rich Authorization Request
// (`type: 'game'`, action `code.write`) rather than a plain scope. So we sit in
// front of the consent screen and inject that `authorization_details` entry,
// without an identifier — which makes the consent screen's game picker prompt
// the user to choose all, one, or several of their games.
//
// Everything else (client_id, redirect_uri, PKCE, state, scope) is forwarded
// untouched, then the browser is sent on to /consent which drives the actual
// Appwrite authorize + approval.

const CODE_WRITE_DETAILS = JSON.stringify([{ type: 'game', actions: ['code.write'] }]);

export function GET({ url }) {
	const params = new URLSearchParams(url.searchParams);

	// Only inject our RAR when the client didn't request its own — never override
	// an explicit authorization_details a more capable client might send.
	if (!params.has('authorization_details')) {
		params.set('authorization_details', CODE_WRITE_DETAILS);
	}

	throw redirect(302, `/consent?${params.toString()}`);
}
