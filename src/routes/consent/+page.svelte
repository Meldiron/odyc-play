<script lang="ts">
	import { onMount } from 'svelte';
	import { stores } from '$lib/stores.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Situation B: a grant exists and the user must give explicit consent.
	const showConsent = $derived(!!data.grantId);
	// No grant yet but already logged in: bounce straight back to /authorize.
	// (Unauthenticated users were redirected to /auth/sign-in by the load fn.)
	const redirecting = $derived(!data.grantId && data.isLoggedIn);

	onMount(() => {
		if (redirecting) {
			window.location.href = data.authorizeUrl;
		}
	});

	const SCOPE_LABELS: Record<string, string> = {
		openid: 'consent.scope.openid',
		profile: 'consent.scope.profile',
		email: 'consent.scope.email',
		'profile.read': 'consent.scope.profileRead',
		'profile.write': 'consent.scope.profileWrite'
	};

	function scopeLabel(scope: string) {
		const key = SCOPE_LABELS[scope];
		return key ? stores.t(key as Parameters<typeof stores.t>[0]) : scope;
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
				{#if redirecting}
					<p class="text-muted-foreground text-center text-sm">
						{stores.t('consent.redirecting')}
					</p>
				{:else if showConsent}
					<!-- Situation B: consent UI -->
					<div class="flex flex-col gap-6">
						<div class="flex flex-col items-center gap-2 text-center">
							<h1 class="text-xl font-bold">{stores.t('consent.heading')}</h1>
							<p class="text-muted-foreground max-w-[210px] text-sm">
								<span class="text-foreground font-semibold"
									>{data.appName ?? stores.t('consent.anApp')}</span
								>
								{stores.t('consent.wantsAccess')}
							</p>
						</div>

						<Separator />

						{#if data.scopes.length > 0}
							<div class="flex flex-col gap-3">
								<p class="text-muted-foreground text-sm">{stores.t('consent.permissions')}</p>
								<ul class="flex flex-col gap-2">
									{#each data.scopes as scope (scope)}
										<li class="flex items-start gap-2 text-sm">
											<CheckIcon class="text-primary mt-0.5 size-4 flex-shrink-0" />
											<span>{scopeLabel(scope)}</span>
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						<div class="grid grid-cols-2 gap-4">
							<!-- Deny → POST grant_id to reject endpoint -->
							<form method="POST" action={data.rejectUrl}>
								<input type="hidden" name="grant_id" value={data.grantId} />
								<Button type="submit" variant="outline" class="w-full">
									{stores.t('consent.deny')}
								</Button>
							</form>
							<!-- Allow → POST grant_id to approve endpoint -->
							<form method="POST" action={data.approveUrl}>
								<input type="hidden" name="grant_id" value={data.grantId} />
								<Button type="submit" class="w-full">
									{stores.t('consent.allow')}
								</Button>
							</form>
						</div>
					</div>
				{:else}
					<p class="text-muted-foreground text-center text-sm">
						{stores.t('consent.invalidRequest')}
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
