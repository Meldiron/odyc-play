import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { APPWRITE_PROJECT_ID } from '$lib/constants';
import type { Games } from '$lib/appwrite';
import { redirect } from '@sveltejs/kit';
import { AppwriteException, Query } from 'appwrite';

export const ssr = false;

// A single RFC 9396 `authorization_details` entry. Each has a `type` plus
// project-defined fields; for `type: 'game'` the consent screen lets the user
// bind the request to one of their games (`identifier`) and shows the granted
// `actions` (currently only `code.write`).
export type AuthorizationDetail = {
	type: string;
	identifier?: string;
	actions?: string[];
	locations?: string[];
};

function parseAuthorizationDetails(raw: string | undefined | null): AuthorizationDetail[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as AuthorizationDetail[]) : [];
	} catch {
		return [];
	}
}

export const load: PageLoad = async ({ url }) => {
	let grantId = url.searchParams.get('grant_id');

	const user = await Backend.getUserSafe();
	if (!user) {
		const returnTo = `/consent${url.search}`;
		throw redirect(307, `/auth/sign-in?redirect=${encodeURIComponent(returnTo)}`);
	}

	// Users who sign in mid-consent (e.g. Email OTP) never pass through the
	// dashboard layout that normally creates their profile. Ensure it exists
	// before authorizing, so the OAuth2 token/claims step can't fail on a user
	// that has no profile backing their account.
	const profileId = await Backend.ensureProfile(user);

	if (!grantId) {
		try {
			const res = await Backend.authorize(url.searchParams);
			if (res.redirectUrl) {
				throw redirect(307, res.redirectUrl);
			}
			grantId = res.grantId;
		} catch (e) {
			const isAppwriteUnauthorized =
				e instanceof AppwriteException && e.type === 'user_unauthorized';

			if (isAppwriteUnauthorized) {
				const returnTo = `/consent${url.search}`;
				throw redirect(307, `/auth/sign-in?redirect=${encodeURIComponent(returnTo)}`);
			}
			throw e;
		}
	}

	// The grant carries the scopes the user is being asked to consent to, plus
	// the app it was created for. Resolve the app's display name separately.
	const grant = await Backend.getGrant(grantId);

	let appName: string | null = null;
	try {
		const app = await Backend.getApp(grant.appId);
		appName = app.name;
	} catch {
		// Fall back to the generic label.
	}

	const authorizationDetails = parseAuthorizationDetails(grant.authorizationDetails);

	// Only the user can bind a `type: 'game'` request to a concrete game, so load
	// the games they own to populate the picker. Skipped entirely when no game
	// detail was requested, to avoid an extra round trip.
	let games: Games[] = [];
	if (authorizationDetails.some((detail) => detail.type === 'game')) {
		const result = await Backend.listGames([
			Query.equal('ownerProfileId', profileId),
			Query.orderDesc('$updatedAt'),
			Query.limit(100)
		]);
		games = result.documents;
	}

	return {
		grantId,
		scopes: grant.scopes,
		projectId: APPWRITE_PROJECT_ID,
		appName,
		authorizationDetails,
		games
	};
};
