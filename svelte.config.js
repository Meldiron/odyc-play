import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// SSR
		adapter: adapter(),

		// SvelteKit's CSRF protection blocks cross-origin form-encoded POSTs, which
		// breaks the OAuth2 token endpoint (RFC 6749 mandates form encoding, and MCP
		// hosts post from their own origin). The app has no cookie-based form
		// actions for this to protect — every POST handler is a stateless,
		// Bearer-authenticated /v1 API with its own CORS — so we turn off the global
		// check and re-apply an equivalent one for non-API routes in hooks.server.ts.
		csrf: { checkOrigin: false }
		// Static
		// adapter: adapter({
		// 	pages: 'build',
		// 	assets: 'build',
		// 	fallback: 'index.html',
		// 	precompress: false,
		// 	strict: true
		// })
	}
};

export default config;
