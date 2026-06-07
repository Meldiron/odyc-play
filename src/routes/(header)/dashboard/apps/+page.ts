import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { Dependencies } from '$lib/constants';
import { Query } from 'appwrite';
import type { Models } from 'appwrite';

const DEFAULT_LIMIT = 12;

export const load: PageLoad = async ({ url, depends, parent }) => {
	depends(Dependencies.APPS);

	await parent();

	const limit = Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT);
	const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

	let apps: Models.AppsList = { total: 0, apps: [] };
	try {
		apps = await Backend.listAllApps([Query.limit(limit), Query.offset(offset)]);
	} catch {
		// No apps available or insufficient permissions
	}

	return { apps, limit, offset };
};
