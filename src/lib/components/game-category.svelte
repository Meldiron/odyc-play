<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Games } from '$lib/appwrite';
	import { Backend } from '$lib/backend';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import { generateGametName } from '$lib/generateGameName';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import { Query, type Models } from 'appwrite';
	import { toast } from 'svelte-sonner';
	import { MediaQuery } from 'svelte/reactivity';
	import GameCardsStateful from './game-cards-stateful.svelte';
	import Button from './ui/button/button.svelte';
	import { stores } from '$lib/stores.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import CreateGameCliDialog from './create-game-cli-dialog.svelte';
	import IconWorldWww from '@tabler/icons-svelte/icons/world-www';
	import IconTerminal2 from '@tabler/icons-svelte/icons/terminal-2';
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import { Badge } from '$lib/components/ui/badge/index.js';

	const isDesktop = new MediaQuery('(min-width: 768px)');

	const siblingCount = $derived(isDesktop.current ? 1 : 0);

	type Props = {
		title: string;
		games: Models.DocumentList<Games>;
		allowCreate: boolean;
		queries: string[];
		children: any;
		perPage?: number;
		linkToPublic?: boolean;
	};

	const props: Props = $props();

	const perPage = props.perPage ?? 4;

	let games = $derived(props.games);

	let isLoading = $state(false);
	let isCliDialogOpen = $state(false);

	async function onPageChange(page: number) {
		games = await Backend.listGames([...props.queries, Query.offset(perPage * (page - 1))]);
	}

	async function createGame() {
		isLoading = true;
		try {
			const game = await Backend.createGame(generateGametName());
			isLoading = false;
			goto('/dashboard/games/' + game.$id);
			toast.success('Game successfully created!');
		} catch (error: any) {
			toast.error(error.message);
			isLoading = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
		<h1 class="font-title flex-shrink-0 text-3xl">{props.title ?? 'Unnamed Category'}</h1>

		{#if props.allowCreate}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger disabled={isLoading}>
					{#snippet child({ props: triggerProps })}
						<Button type="button" disabled={isLoading} {...triggerProps}>
							{#if isLoading}
								<Loader2Icon class="animate-spin" />
							{/if}
							{stores.t('games.create')}
							<IconChevronDown class="size-4 opacity-70" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="w-72" align="end">
					<DropdownMenu.Item class="items-start gap-3 py-2.5" onclick={createGame}>
						<IconWorldWww class="text-muted-foreground mt-0.5 size-5 flex-shrink-0" />
						<div class="flex flex-col gap-0.5">
							<span class="flex items-center gap-2 font-medium">
								{stores.t('games.createWebEditor')}
								<Badge variant="secondary" class="px-1.5 py-0 text-[10px] font-normal">
									{stores.t('games.createWebEditorBadge')}
								</Badge>
							</span>
							<span class="text-muted-foreground text-xs leading-snug">
								{stores.t('games.createWebEditorDescription')}
							</span>
						</div>
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="items-start gap-3 py-2.5"
						onclick={() => (isCliDialogOpen = true)}
					>
						<IconTerminal2 class="text-muted-foreground mt-0.5 size-5 flex-shrink-0" />
						<div class="flex flex-col gap-0.5">
							<span class="font-medium">{stores.t('games.createCli')}</span>
							<span class="text-muted-foreground text-xs leading-snug">
								{stores.t('games.createCliDescription')}
							</span>
						</div>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	</div>
	<div class="flex flex-col gap-4 md:gap-6">
		<div class="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
			{#if games.total === 0 && props.children}
				{@render props.children()}
			{/if}

			{#each games.documents as game (game.$id)}
				<GameCardsStateful linkToPublic={props.linkToPublic} {game} />
			{/each}
		</div>
	</div>
	{#if Math.ceil(games.total / perPage) > 1}
		<Pagination.Root
			{onPageChange}
			class="flex sm:justify-end"
			count={games.total}
			{perPage}
			{siblingCount}
		>
			{#snippet children({ pages, currentPage })}
				<Pagination.Content>
					<Pagination.Item>
						<Pagination.PrevButton>
							<ChevronLeftIcon class="size-4" />
						</Pagination.PrevButton>
					</Pagination.Item>
					{#each pages as page (page.key)}
						{#if page.type === 'ellipsis'}
							<Pagination.Item>
								<Pagination.Ellipsis />
							</Pagination.Item>
						{:else}
							<Pagination.Item>
								<Pagination.Link {page} isActive={currentPage === page.value}>
									{page.value}
								</Pagination.Link>
							</Pagination.Item>
						{/if}
					{/each}
					<Pagination.Item>
						<Pagination.NextButton>
							<ChevronRightIcon class="size-4" />
						</Pagination.NextButton>
					</Pagination.Item>
				</Pagination.Content>
			{/snippet}
		</Pagination.Root>
	{/if}
</div>

<CreateGameCliDialog bind:open={isCliDialogOpen} />
