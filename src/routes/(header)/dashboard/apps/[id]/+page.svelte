<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { stores } from '$lib/stores.svelte';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import LifeBuoyIcon from '@lucide/svelte/icons/life-buoy';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import MailIcon from '@lucide/svelte/icons/mail';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const app = $derived(data.app);

	const links = $derived(
		[
			{ label: stores.t('marketplace.homepage'), url: app.clientUri, icon: GlobeIcon },
			{ label: stores.t('marketplace.support'), url: app.supportUrl, icon: LifeBuoyIcon },
			{ label: stores.t('marketplace.privacy'), url: app.privacyPolicyUrl, icon: ShieldIcon },
			{ label: stores.t('marketplace.terms'), url: app.termsUrl, icon: FileTextIcon },
			{ label: stores.t('marketplace.dataDeletion'), url: app.dataDeletionUrl, icon: Trash2Icon }
		].filter((link) => !!link.url)
	);
</script>

<div class="mx-auto w-full max-w-6xl px-4 py-4 lg:px-6 lg:py-6">
	<Breadcrumb.Root class="mb-6">
		<Breadcrumb.List>
			<Breadcrumb.Item>
				<Breadcrumb.Link href="/dashboard/apps">{stores.t('marketplace.backToApps')}</Breadcrumb.Link>
			</Breadcrumb.Item>
			<Breadcrumb.Separator />
			<Breadcrumb.Item>
				<Breadcrumb.Page>{app.name}</Breadcrumb.Page>
			</Breadcrumb.Item>
		</Breadcrumb.List>
	</Breadcrumb.Root>

	<!-- Hero -->
	<div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex items-start gap-4 sm:gap-5">
			<Avatar.Root class="size-16 flex-shrink-0 rounded-2xl border sm:size-20">
				<Avatar.Image src={app.logoUri} alt="" class="object-cover" />
				<Avatar.Fallback class="rounded-2xl text-2xl font-medium">
					{app.name.charAt(0).toUpperCase()}
				</Avatar.Fallback>
			</Avatar.Root>
			<div class="min-w-0">
				<h1 class="font-title text-3xl leading-tight break-words">{app.name}</h1>
				{#if app.tagline}
					<p class="text-muted-foreground mt-1 text-base">{app.tagline}</p>
				{/if}
				{#if app.tags?.length}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each app.tags as tag (tag)}
							<Badge variant="secondary">{tag}</Badge>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		{#if app.clientUri}
			<Button
				href={app.clientUri}
				target="_blank"
				rel="noopener noreferrer"
				class="flex-shrink-0"
			>
				<ExternalLinkIcon class="size-4" />
				{stores.t('marketplace.openApp')}
			</Button>
		{/if}
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Main column -->
		<div class="flex flex-col gap-6 lg:col-span-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>{stores.t('marketplace.about')}</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if app.description}
						<p class="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
							{app.description}
						</p>
					{:else}
						<p class="text-muted-foreground text-sm italic">
							{stores.t('marketplace.noDescription')}
						</p>
					{/if}
				</Card.Content>
			</Card.Root>

			{#if app.images?.length}
				<div class="flex flex-col gap-3">
					<h2 class="text-lg font-medium">{stores.t('marketplace.screenshots')}</h2>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{#each app.images as image, i (image)}
							<div class="bg-muted overflow-hidden rounded-xl border">
								<img
									src={image}
									alt="{app.name} screenshot {i + 1}"
									loading="lazy"
									class="aspect-video w-full object-cover"
								/>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="flex flex-col gap-6">
			{#if links.length || app.contacts?.length}
				<Card.Root>
					<Card.Header>
						<Card.Title>{stores.t('marketplace.links')}</Card.Title>
					</Card.Header>
					<Card.Content class="flex flex-col gap-1">
						{#each links as link (link.url)}
							<a
								href={link.url}
								target="_blank"
								rel="noopener noreferrer"
								class="hover:bg-muted -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors"
							>
								<span class="flex items-center gap-2.5">
									<link.icon class="text-muted-foreground size-4" />
									{link.label}
								</span>
								<ExternalLinkIcon class="text-muted-foreground size-3.5" />
							</a>
						{/each}

						{#if app.contacts?.length}
							{#if links.length}
								<Separator class="my-2" />
							{/if}
							<p class="text-muted-foreground px-0 pb-1 text-xs font-medium tracking-wide uppercase">
								{stores.t('marketplace.contact')}
							</p>
							{#each app.contacts as contact (contact)}
								<a
									href="mailto:{contact}"
									class="hover:bg-muted -mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors"
								>
									<MailIcon class="text-muted-foreground size-4" />
									<span class="truncate">{contact}</span>
								</a>
							{/each}
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	</div>
</div>
