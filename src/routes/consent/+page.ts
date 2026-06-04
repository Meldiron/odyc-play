import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { APPWRITE_PROJECT_ID } from '$lib/constants';
import { redirect } from '@sveltejs/kit';
import { AppwriteException } from 'appwrite';

export const ssr = false;

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
	await Backend.ensureProfile(user);

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

	return {
		grantId,
		scopes: grant.scopes,
		projectId: APPWRITE_PROJECT_ID,
		appName
	};
};
