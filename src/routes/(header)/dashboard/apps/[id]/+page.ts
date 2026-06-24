import type { PageLoad } from './$types';
import { Backend } from '$lib/backend';
import { Dependencies } from '$lib/constants';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, depends, parent }) => {
	depends(Dependencies.APP);

	await parent();

	try {
		const app = await Backend.getApp(params.id);
		return { app };
	} catch {
		throw error(404, 'App not found');
	}
};
