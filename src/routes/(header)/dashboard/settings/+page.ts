import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { Dependencies } from '$lib/constants';
import type { Models } from 'appwrite';

export const load: PageLoad = async ({ depends }) => {
	depends(Dependencies.APPS);

	let apps: Models.AppsList = { total: 0, apps: [] };
	try {
		apps = await Backend.listApps();
	} catch {
		// User may not have permission or no apps exist yet
	}

	return { apps };
};
