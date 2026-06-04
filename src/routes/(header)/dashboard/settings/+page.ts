import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { Dependencies } from '$lib/constants';
import { stores } from '$lib/stores.svelte';
import type { Models } from 'appwrite';

export const load: PageLoad = async ({ depends, parent }) => {
	depends(Dependencies.APPS);

	// Ensure the dashboard layout has resolved the current user before we read it.
	await parent();

	let apps: Models.AppsList = { total: 0, apps: [] };
	if (stores.user) {
		try {
			apps = await Backend.listApps(stores.user.$id);
		} catch {
			// User may not have permission or no apps exist yet
		}
	}

	return { apps };
};
