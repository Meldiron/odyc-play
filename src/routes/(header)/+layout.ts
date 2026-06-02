import { Backend } from '$lib/backend';
import { Dependencies } from '$lib/constants';
import { stores } from '$lib/stores.svelte';
import { Query, type Models } from 'appwrite';
import type { LayoutLoad } from './$types';
import type { Games } from '$lib/appwrite';

export const ssr = false;

export const load: LayoutLoad = async ({ depends }) => {
	depends(Dependencies.PROFILE);
	depends(Dependencies.USER);

	await stores.fetchUser();

	if (stores.user) {
		const hadProfile = Boolean(stores.user.prefs.profileId);
		const profileId = await Backend.ensureProfile(stores.user);
		// A freshly created profile means prefs changed server-side; refresh the
		// user so `prefs.profileId` is reflected locally.
		if (!hadProfile) {
			await stores.fetchUser();
		}
		await stores.fetchProfile(profileId);
	}

	let games: Models.DocumentList<Games> = {
		total: 0,
		documents: []
	};
	try {
		games = await Backend.listGames([Query.limit(50), Query.select(['$id', 'name', 'slug'])]);
	} catch {
		// Empty array
	}

	return {
		theme: stores.user?.prefs?.theme ?? 'dark',
		games
	};
};
