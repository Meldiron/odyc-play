<script lang="ts">
	import { goto } from '$app/navigation';
	import { stores } from '$lib/stores.svelte';
	import { Backend } from '$lib/backend';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Pre-filled from the verification_uri_complete link, but never auto-submitted —
	// the user must explicitly confirm (RFC 8628 §3.3.1).
	let userCode = $state(data.userCode);
	let submitting = $state(false);
	let error = $state<string | null>(null);

	async function onSubmit(event: Event) {
		event.preventDefault();
		const code = userCode.trim();
		if (!code) return;

		submitting = true;
		error = null;
		try {
			// Exchange the user code for a grant bound to the signed-in user, then
			// hand off to the shared consent screen to collect approval.
			const grant = await Backend.createGrant(code);
			await goto(`/consent?grant_id=${encodeURIComponent(grant.$id)}`);
		} catch {
			error = stores.t('device.invalidCode');
			submitting = false;
		}
	}
</script>

<div class="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
	<div class="flex w-full max-w-md flex-col gap-6">
		<a href="/" class="flex flex-col items-center gap-2 self-center font-medium">
			<div class="flex items-center justify-center rounded-md">
				<img src="/logo.png" class="pixelated size-12" alt="Odyc.js Play Logo" />
			</div>
		</a>

		<Card.Root>
			<Card.Content>
				<form onsubmit={onSubmit} class="flex flex-col gap-6">
					<div class="flex flex-col items-center gap-2 text-center">
						<h1 class="text-xl font-bold">{stores.t('device.heading')}</h1>
						<p class="text-muted-foreground max-w-[260px] text-sm">
							{stores.t('device.description')}
						</p>
					</div>

					<div class="grid gap-2">
						<Label for="device-code">{stores.t('device.codeLabel')}</Label>
						<Input
							id="device-code"
							bind:value={userCode}
							autocomplete="off"
							autocapitalize="characters"
							spellcheck={false}
							class="text-center font-mono text-lg tracking-widest uppercase"
						/>
						{#if error}
							<p class="text-destructive text-sm">{error}</p>
						{/if}
					</div>

					<Button type="submit" disabled={submitting || !userCode.trim()} class="w-full">
						{stores.t('device.continue')}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
