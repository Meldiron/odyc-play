<script lang="ts">
	import { stores } from '$lib/stores.svelte';
	import type { Games } from '$lib/appwrite';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import GamepadIcon from '@lucide/svelte/icons/gamepad';
	import GlobeIcon from '@lucide/svelte/icons/globe';

	type GameOption = { id: string; name: string };

	let {
		games,
		actions = [],
		actionLabel,
		// The resolved identifiers for this authorization detail: either `['*']`
		// for the all-games wildcard, or one entry per selected game id.
		identifiers = $bindable([])
	}: {
		games: Games[];
		actions?: string[];
		actionLabel: (action: string) => string;
		identifiers: string[];
	} = $props();

	// Seed the picker from whatever identifier the client pre-requested: `*`
	// opens in all-games mode, a concrete id pre-selects that game, anything
	// else starts on an empty "specific games" picker.
	const seeded = identifiers.filter((id) => id && id !== '*');
	let mode = $state<'all' | 'specific'>(identifiers.includes('*') ? 'all' : 'specific');
	let selected = $state<GameOption[]>(
		seeded.map((id) => ({ id, name: games.find((g) => g.$id === id)?.name ?? id }))
	);

	let comboOpen = $state(false);
	let search = $state('');

	const selectedIds = $derived(new Set(selected.map((g) => g.id)));

	// Client-side search over the user's recent games: drop already-picked games,
	// match the query against the name, and keep the 5 most recent (the list
	// arrives ordered by recency). No fulltext index exists on `name`, so we
	// filter the prefetched list rather than querying per keystroke.
	const matches = $derived(
		games
			.filter((g) => !selectedIds.has(g.$id))
			.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()))
			.slice(0, 5)
	);

	// Push the active selection back up to the parent as resolved identifiers.
	$effect(() => {
		identifiers = mode === 'all' ? ['*'] : selected.map((g) => g.id);
	});

	function addGame(game: Games) {
		if (selectedIds.has(game.$id)) return;
		selected = [...selected, { id: game.$id, name: game.name }];
		search = '';
	}

	function removeGame(id: string) {
		selected = selected.filter((g) => g.id !== id);
	}
</script>

<div class="flex flex-col gap-3">
	<p class="text-muted-foreground text-sm">{stores.t('consent.selectGame')}</p>

	{#if games.length > 0}
		<ToggleGroup.Root
			type="single"
			variant="outline"
			value={mode}
			onValueChange={(value) => {
				if (value === 'all' || value === 'specific') mode = value;
			}}
			class="w-full"
		>
			<ToggleGroup.Item value="all" class="gap-2">
				<GlobeIcon class="size-4" />
				{stores.t('consent.gameAccessAll')}
			</ToggleGroup.Item>
			<ToggleGroup.Item value="specific" class="gap-2">
				<GamepadIcon class="size-4" />
				{stores.t('consent.gameAccessSpecific')}
			</ToggleGroup.Item>
		</ToggleGroup.Root>

		{#if mode === 'all'}
			<div
				class="border-primary/30 bg-primary/5 flex items-start gap-2 rounded-md border border-dashed p-3 text-sm"
			>
				<GlobeIcon class="text-primary mt-0.5 size-4 flex-shrink-0" />
				<span class="text-muted-foreground">{stores.t('consent.gameAccessAllHint')}</span>
			</div>
		{:else}
			<Popover.Root bind:open={comboOpen}>
				<Popover.Trigger
					class="border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring text-muted-foreground flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					<span class="flex items-center gap-2">
						<PlusIcon class="size-4" />
						{stores.t('consent.gameAddPlaceholder')}
					</span>
				</Popover.Trigger>
				<Popover.Content class="w-(--bits-floating-anchor-width) p-0" align="start">
					<Command.Root shouldFilter={false}>
						<Command.Input
							bind:value={search}
							placeholder={stores.t('consent.gameSearchPlaceholder')}
						/>
						<Command.List>
							<Command.Empty>{stores.t('consent.gameNoResults')}</Command.Empty>
							{#each matches as game (game.$id)}
								<Command.Item value={game.$id} onSelect={() => addGame(game)} class="gap-2">
									<GamepadIcon class="text-muted-foreground size-4" />
									<span class="truncate">{game.name}</span>
								</Command.Item>
							{/each}
						</Command.List>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>

			{#if selected.length > 0}
				<ul class="flex flex-col gap-2">
					{#each selected as game (game.id)}
						<li
							class="bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
						>
							<span class="flex min-w-0 items-center gap-2">
								<GamepadIcon class="text-muted-foreground size-4 flex-shrink-0" />
								<span class="truncate font-medium">{game.name}</span>
							</span>
							<button
								type="button"
								onclick={() => removeGame(game.id)}
								aria-label={stores.t('consent.removeGame')}
								class="text-muted-foreground hover:bg-background hover:text-foreground flex size-6 flex-shrink-0 items-center justify-center rounded-md transition-colors"
							>
								<XIcon class="size-4" />
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-muted-foreground text-center text-sm">
					{stores.t('consent.gameSelectedEmpty')}
				</p>
			{/if}
		{/if}

		{#if actions.length > 0}
			<p class="text-muted-foreground text-sm">{stores.t('consent.gamePermissions')}</p>
			<ul class="flex flex-col gap-2">
				{#each actions as action (action)}
					<li class="flex items-start gap-2 text-sm">
						<CheckIcon class="text-primary mt-0.5 size-4 flex-shrink-0" />
						<span>{actionLabel(action)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<p class="text-muted-foreground text-sm">{stores.t('consent.noGames')}</p>
	{/if}
</div>
