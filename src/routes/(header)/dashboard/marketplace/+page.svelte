<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { stores } from '$lib/stores.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import StoreIcon from '@lucide/svelte/icons/store';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const apps = $derived(data.apps.apps);
	const total = $derived(data.apps.total);

	const from = $derived(total === 0 ? 0 : data.offset + 1);
	const to = $derived(Math.min(data.offset + data.limit, total));

	const hasPrevious = $derived(data.offset > 0);
	const hasNext = $derived(data.offset + data.limit < total);

	function goToOffset(offset: number) {
		goto(`/dashboard/marketplace?limit=${data.limit}&offset=${Math.max(0, offset)}`);
	}
</script>

<div class="mx-auto w-full max-w-7xl px-4 pt-4 lg:px-6 lg:pt-6">
	<div class="mb-6 flex flex-row items-start justify-between gap-4">
		<div>
			<h1 class="font-title text-3xl">{stores.t('marketplace.title')}</h1>
			<p class="text-muted-foreground mt-1 text-sm">{stores.t('marketplace.description')}</p>
		</div>
		<Button onclick={() => goto('/dashboard/settings')} class="flex-shrink-0">
			<PlusIcon class="size-4" />
			{stores.t('marketplace.createApp')}
		</Button>
	</div>

	{#if apps.length === 0}
		<div
			class="border-muted-foreground/25 flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center"
		>
			<div
				class="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full"
			>
				<StoreIcon class="size-6" />
			</div>
			<p class="text-muted-foreground max-w-sm text-sm">{stores.t('marketplace.empty')}</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each apps as app (app.$id)}
				<Card.Root class="flex flex-col">
					<Card.Header>
						<Card.Title class="truncate">{app.name}</Card.Title>
					</Card.Header>
					<Card.Footer class="mt-auto">
						<Button
							variant="outline"
							size="sm"
							href="https://google.com"
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLinkIcon class="size-4" />
							{stores.t('marketplace.visit')}
						</Button>
					</Card.Footer>
				</Card.Root>
			{/each}
		</div>

		<div class="mt-6 flex items-center justify-between">
			<p class="text-muted-foreground text-sm">
				{from}–{to}
				{stores.t('marketplace.of')}
				{total}
			</p>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={!hasPrevious}
					onclick={() => goToOffset(data.offset - data.limit)}
				>
					{stores.t('marketplace.previous')}
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={!hasNext}
					onclick={() => goToOffset(data.offset + data.limit)}
				>
					{stores.t('marketplace.next')}
				</Button>
			</div>
		</div>
	{/if}
</div>
