import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { APPWRITE_PROJECT_ID } from '$lib/constants';
import { redirect } from '@sveltejs/kit';
import { AppwriteException } from 'appwrite';

export const ssr = false;

export const load: PageLoad = async ({ url, fetch }) => {
	let grantId = url.searchParams.get('grant_id');
	const clientId = url.searchParams.get('client_id');
	const scope = url.searchParams.get('scope') ?? '';

	const user = await Backend.getUserSafe();
	if (!user) {
		const returnTo = `/consent${url.search}`;
		throw redirect(307, `/auth/sign-in?redirect=${encodeURIComponent(returnTo)}`);
	}

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

	let appName: string | null = null;
	if (clientId) {
		try {
			// SSR endpoint as it needs Appwrite API key
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
		projectId: APPWRITE_PROJECT_ID,
		appName
	};
};
