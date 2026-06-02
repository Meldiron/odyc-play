import { Apps, Client } from 'node-appwrite';
import { SSR_APPWRITE_API_KEY } from '$env/static/private';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '$lib/constants';
import { json } from '@sveltejs/kit';

// Resolves the public-facing details of an OAuth2 app by its client id.
// Apps are owned by developers and cannot be read with an end user's session,
// so we use the server SDK + API key here (consent screen is public-facing).
export async function GET({ url }) {
	const clientId = url.searchParams.get('clientId') ?? '';

	if (!clientId) {
		return json({ name: null });
	}

	const client = new Client()
		.setEndpoint(APPWRITE_ENDPOINT)
		.setProject(APPWRITE_PROJECT_ID)
		.setKey(SSR_APPWRITE_API_KEY);

	const apps = new Apps(client);

	try {
		const app = await apps.get(clientId);
		return json({ name: app.name, type: app.type });
	} catch {
		return json({ name: null });
	}
}
