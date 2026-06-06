<script lang="ts">
	import { goto } from '$app/navigation';
	import { stores } from '$lib/stores.svelte';
	import { Backend } from '$lib/backend';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GameAccessPicker from './game-access-picker.svelte';
	import type { PageProps } from './$types';
	import type { AuthorizationDetail } from './+page';

	let { data }: PageProps = $props();

	let submitting = $state(false);

	// The `type: 'game'` details, kept with their original index so we can write
	// the user's choice back into the right entry when approving.
	const gameDetails = data.authorizationDetails
		.map((detail, index) => ({ detail, index }))
		.filter(({ detail }) => detail.type === 'game');

	// Resolved identifiers per detail index. Each picker writes back either
	// `['*']` (all games) or one entry per chosen game; pre-filled from the
	// identifier the client originally requested.
	let detailIdentifiers = $state<Record<number, string[]>>(
		Object.fromEntries(
			gameDetails.map(({ detail, index }) => [index, detail.identifier ? [detail.identifier] : []])
		)
	);

	// Approval is blocked until every game detail resolves to at least one
	// identifier, so we never record a `type: 'game'` entry without a target.
	const allGamesSelected = $derived(
		gameDetails.every(({ index }) => (detailIdentifiers[index]?.length ?? 0) > 0)
	);

	async function allow() {
		submitting = true;
		// Expand each requested game detail into one entry per chosen identifier
		// (the `*` wildcard collapses to a single all-games entry).
		const enriched: AuthorizationDetail[] = data.authorizationDetails.flatMap((detail, index) => {
			if (detail.type !== 'game') return [detail];
			return (detailIdentifiers[index] ?? []).map((identifier) => ({ ...detail, identifier }));
		});
		const authorizationDetails = enriched.length > 0 ? JSON.stringify(enriched) : undefined;
		const { redirectUrl } = await Backend.approve(data.grantId, authorizationDetails);
		// The device flow (RFC 8628) has no browser redirect target — the device polls
		// for the token on its own. Send the user to a finish screen instead of
		// reloading the now-consumed grant, which would 404 as "grant not found".
		if (redirectUrl) {
			window.location.href = redirectUrl;
		} else {
			await goto('/device-success');
		}
	}

	async function deny() {
		submitting = true;
		const { redirectUrl } = await Backend.reject(data.grantId);
		if (redirectUrl) {
			window.location.href = redirectUrl;
		} else {
			await goto('/');
		}
	}

	const SCOPE_LABELS: Record<string, string> = {
		openid: 'consent.scope.openid',
		profile: 'consent.scope.profile',
		email: 'consent.scope.email',
		'profile.read': 'consent.scope.profileRead',
		'profile.write': 'consent.scope.profileWrite',
		'games.create': 'consent.scope.gamesCreate'
	};

	// Actions a game detail can request. Only `code.write` exists today.
	const ACTION_LABELS: Record<string, string> = {
		'code.write': 'consent.action.codeWrite'
	};

	function scopeLabel(scope: string) {
		const key = SCOPE_LABELS[scope];
		return key ? stores.t(key as Parameters<typeof stores.t>[0]) : scope;
	}

	function actionLabel(action: string) {
		const key = ACTION_LABELS[action];
		return key ? stores.t(key as Parameters<typeof stores.t>[0]) : action;
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

					{#each gameDetails as { detail, index } (index)}
						<GameAccessPicker
							games={data.games}
							actions={detail.actions ?? []}
							{actionLabel}
							bind:identifiers={detailIdentifiers[index]}
						/>
					{/each}

					<div class="grid grid-cols-2 gap-4">
						<Button onclick={deny} disabled={submitting} variant="outline" class="w-full">
							{stores.t('consent.deny')}
						</Button>
						<Button onclick={allow} disabled={submitting || !allGamesSelected} class="w-full">
							{stores.t('consent.allow')}
						</Button>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
