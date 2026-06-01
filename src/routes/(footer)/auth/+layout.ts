import { stores } from '$lib/stores.svelte';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { Dependencies } from '$lib/constants';

export let ssr = false;

export const load: LayoutLoad = async ({ depends, url }) => {
	depends(Dependencies.USER);

	await stores.fetchUser();

	// Where to send the user once they're authenticated. Defaults to home, but
	// flows like the OAuth2 consent screen pass a `redirect` param so we return
	// there afterwards. Only local paths are honored to avoid open redirects.
	const target = url.searchParams.get('redirect');
	const safeTarget = target && target.startsWith('/') && !target.startsWith('//') ? target : '/';

	if (stores.user) {
		throw redirect(307, safeTarget);
	}

	return { redirect: safeTarget };
};
