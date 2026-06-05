<script lang="ts">
	import { goto } from '$app/navigation';
	import { stores } from '$lib/stores.svelte';
	import { Backend } from '$lib/backend';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as InputOTP from '$lib/components/ui/input-otp/index.js';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import type { PageProps } from './$types';

	const CODE_LENGTH = 6;
	// Restrict typing/pasting to digits — the device code is always 6 numbers.
	const DIGITS_ONLY = '^\\d+$';

	let { data }: PageProps = $props();

	// Pre-filled from the verification_uri_complete link, but never auto-submitted —
	// the user must explicitly confirm (RFC 8628 §3.3.1).
	let userCode = $state(data.userCode);
	let submitting = $state(false);
	let error = $state<string | null>(null);

	const complete = $derived(userCode.length === CODE_LENGTH);

	async function onSubmit(event: Event) {
		event.preventDefault();
		if (!complete || submitting) return;

		submitting = true;
		error = null;
		try {
			// Exchange the user code for a grant bound to the signed-in user, then
			// hand off to the shared consent screen to collect approval.
			const grant = await Backend.createGrant(userCode);
			await goto(`/consent?grant_id=${encodeURIComponent(grant.$id)}`);
		} catch {
			error = stores.t('device.invalidCode');
			submitting = false;
		}
	}

	// Clear a previous error as soon as the user edits the code again.
	function onValueChange() {
		if (error) error = null;
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
				<form onsubmit={onSubmit} class="flex flex-col gap-8">
					<div class="flex flex-col items-center gap-2 text-center">
						<h1 class="text-xl font-bold">{stores.t('device.heading')}</h1>
						<p class="text-muted-foreground max-w-[260px] text-sm text-balance">
							{stores.t('device.description')}
						</p>
					</div>

					<div class="flex flex-col items-center gap-3">
						<InputOTP.Root
							maxlength={CODE_LENGTH}
							pattern={DIGITS_ONLY}
							bind:value={userCode}
							{onValueChange}
							disabled={submitting}
							aria-label={stores.t('device.codeLabel')}
							aria-invalid={error ? 'true' : undefined}
						>
							{#snippet children({ cells })}
								<InputOTP.Group>
									{#each cells.slice(0, 3) as cell (cell)}
										<InputOTP.Slot
											{cell}
											aria-invalid={error ? 'true' : undefined}
											class="size-12 text-lg font-semibold md:size-14 md:text-xl"
										/>
									{/each}
								</InputOTP.Group>
								<InputOTP.Separator class="text-muted-foreground px-1">
									<MinusIcon class="size-4" />
								</InputOTP.Separator>
								<InputOTP.Group>
									{#each cells.slice(3, 6) as cell (cell)}
										<InputOTP.Slot
											{cell}
											aria-invalid={error ? 'true' : undefined}
											class="size-12 text-lg font-semibold md:size-14 md:text-xl"
										/>
									{/each}
								</InputOTP.Group>
							{/snippet}
						</InputOTP.Root>

						{#if error}
							<p class="text-destructive text-center text-sm">{error}</p>
						{/if}
					</div>

					<Button type="submit" disabled={submitting || !complete} class="w-full">
						{stores.t('device.continue')}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
