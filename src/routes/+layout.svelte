<script lang="ts">
	import 'codemirror-theme-vars/base.css';
	import '../app.css';
	import '../editor.css';

	import { Backend } from '$lib/backend';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { stores } from '$lib/stores.svelte';
	import { ModeWatcher, userPrefersMode } from 'mode-watcher';

	let { children, data } = $props();

	let theme = data.theme;

	async function storeTheme(mode: string) {
		await Backend.updateThemePrefs(mode);
	}

	$effect(() => {
		const preference = userPrefersMode.current;
		if (preference && (stores.user?.prefs.theme ?? '') !== preference) {
			if (stores.user) {
				storeTheme(preference);
			}
		}
	});

	$effect(() => {
		if (typeof document !== 'undefined') {
			const locale = stores.user?.prefs?.selectedLocale;
			if (locale) document.documentElement.lang = locale;
		}
	});
</script>

<ModeWatcher
	defaultMode={(theme as 'light' | 'dark' | 'system') || 'dark'}
	lightClassNames={[]}
	darkClassNames={['dark']}
/>
<Toaster position="top-center" />

{@render children()}
