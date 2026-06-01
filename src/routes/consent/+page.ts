import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { APPWRITE_PROJECT, OAUTH2_BASE } from '$lib/constants';
import { redirect } from '@sveltejs/kit';

// Session-dependent; never prerender or SSR this page.
export const ssr = false;

export const load: PageLoad = async ({ url, fetch }) => {
	const grantId = url.searchParams.get('grant_id');
	const clientId = url.searchParams.get('client_id');
	const scope = url.searchParams.get('scope') ?? '';

	const user = await Backend.getUserSafe();

	// Authentication happens on the dedicated sign-in page. If the user has no
	// session yet (and isn't mid-consent), send them there and ask it to return
	// to this exact consent URL once they're signed in.
	if (!grantId && !user) {
		const returnTo = `/consent${url.search}`;
		throw redirect(307, `/auth/sign-in?redirect=${encodeURIComponent(returnTo)}`);
	}

	// Re-enter the OAuth2 flow with the exact same params after login (Situation A).
	const authorizeUrl = `${OAUTH2_BASE}/authorize${url.search}`;

	// Best-effort: resolve the requesting app's display name. Apps are owned by
	// developers and can't be read with an end user's session, so this goes
	// through a server endpoint that uses the server SDK + API key.
	let appName: string | null = null;
	if (clientId) {
		try {
			const res = await fetch(`/api/v1/oauth-app?clientId=${encodeURIComponent(clientId)}`);
			if (res.ok) {
				appName = (await res.json()).name ?? null;
			}
		} catch {
			// Fall back to the generic label.
		}
	}

	return {
		grantId,
		clientId,
		scopes: scope
			.split(' ')
			.map((s) => s.trim())
			.filter(Boolean),
		authorizeUrl,
		approveUrl: `${OAUTH2_BASE}/approve`,
		rejectUrl: `${OAUTH2_BASE}/reject`,
		projectId: APPWRITE_PROJECT,
		appName,
		isLoggedIn: !!user
	};
};
