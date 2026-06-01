<script lang="ts">
	import Paint from '$lib/components/plaint/Paint.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	import { stores } from '$lib/stores.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import Sprite from '$lib/components/plaint/Sprite.svelte';
	import { DefaultProfilePicture, Dependencies } from '$lib/constants';
	import { toast } from 'svelte-sonner';
	import { Backend } from '$lib/backend';
	import { invalidate } from '$app/navigation';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import { defaultLocale, languages, locales, type Locale } from '$lib/i18n';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { goto } from '$app/navigation';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import KeyIcon from '@lucide/svelte/icons/key-round';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const apps = $derived(data.apps.apps);

	let showCreateApp = $state(false);
	let appName = $state('');
	let appType: 'confidential' | 'public' = $state('confidential');
	let appRedirectUris = $state('');
	let appInternal = $state(false);
	let isCreatingApp = $state(false);

	function parseRedirectUris(value: string) {
		return value
			.split('\n')
			.map((uri) => uri.trim())
			.filter((uri) => uri.length > 0);
	}

	function resetCreateAppForm() {
		appName = '';
		appType = 'confidential';
		appRedirectUris = '';
		appInternal = false;
	}

	async function onCreateApp(event: Event) {
		event.preventDefault();
		isCreatingApp = true;

		try {
			const created = await Backend.createApp(
				appName,
				parseRedirectUris(appRedirectUris),
				appType,
				true,
				appInternal
			);
			toast.success(stores.t('apps.created'));
			showCreateApp = false;
			resetCreateAppForm();
			await goto(`/dashboard/settings/apps/${created.$id}`);
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			isCreatingApp = false;
		}
	}

	let appToDelete = $state<string | null>(null);
	let isDeletingApp = $state(false);

	async function onDeleteApp() {
		if (!appToDelete) return;
		isDeletingApp = true;

		try {
			await Backend.deleteApp(appToDelete);
			toast.success(stores.t('apps.deleted'));
			appToDelete = null;
			await invalidate(Dependencies.APPS);
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			isDeletingApp = false;
		}
	}

	let originalName = $state(stores.profile?.name ?? '');
	let originalSprite = $state(stores.profile?.avatarPixels);
	let originalDescription = $state(stores.profile?.description ?? '');

	let name = $state(stores.profile?.name ?? '');
	let description = $state(stores.profile?.description ?? '');
	let sprite = $state(stores.profile?.avatarPixels ?? DefaultProfilePicture);

	let isLoading = $state(false);

	let showEditor = $state(false);
	function setShowEditor(value: boolean) {
		showEditor = value;
	}

	async function onSave(event: Event) {
		event.preventDefault();

		isLoading = true;

		try {
			await Backend.updateProfile(stores.profile?.$id ?? '', name, sprite, description);
			await invalidate(Dependencies.PROFILE);
			toast.success(stores.t('notifications.profileUpdated'));
			originalName = name;
			originalSprite = sprite;
			originalDescription = description;
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			isLoading = false;
		}
	}

	let originalVimModeEnabled = $state(stores.user?.prefs?.vimModeEnabled);
	let vimModeEnabled = $state(stores.user?.prefs?.vimModeEnabled ?? false);
	let originalSelectedLocale = $state(stores.user?.prefs.selectedLocale);
	let selectedLocale: Locale = $state(stores.user?.prefs?.selectedLocale ?? defaultLocale);
	let isLoadingPrefs = $state(false);

	async function onPrefsSave(event: Event) {
		event.preventDefault();

		isLoadingPrefs = true;

		try {
			await Backend.updateVimModePrefs(vimModeEnabled);
			await Backend.updateSelectedLocalePrefs(selectedLocale);
			await invalidate(Dependencies.USER);
			toast.success(stores.t('notifications.preferencesUpdated'));
			originalVimModeEnabled = vimModeEnabled;
			originalSelectedLocale = selectedLocale;
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			isLoadingPrefs = false;
		}
	}
</script>

<div class="mx-auto w-full max-w-4xl p-3">
	<h1 class="font-title my-6 flex-shrink-0 text-3xl">{stores.t('settings')}</h1>
	<div class="flex flex-col gap-6">
		<form onsubmit={onSave}>
			<Card.Root class="w-full">
				<Card.Header>
					<Card.Title>{stores.t('profile.settings')}</Card.Title>
					<Card.Description>{stores.t('profile.settingsDescription')}</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-col gap-6">
						<div class="grid gap-2">
							<Label for="name">{stores.t('profile.name')}</Label>
							<Input
								id="name"
								type="text"
								bind:value={name}
								placeholder={stores.t('profile.placeholder.name')}
								required
							/>
						</div>
						<div class="grid gap-2">
							<Label for="description">{stores.t('profile.description')}</Label>
							<Input
								id="description"
								type="text"
								bind:value={description}
								placeholder="I love making ..."
								required
							/>
						</div>
						<div class="grid gap-2">
							<Label class="text-center">{stores.t('profile.picture')}</Label>
							<Card.Root class="w-[max-content] rounded-md">
								<Card.Content class="flex flex-col items-center gap-4">
									<Sprite class="aspect-square w-full max-w-40" {sprite} />

									<Button onclick={() => setShowEditor(true)} type="button" variant="outline"
										>{stores.t('profile.openEditor')}</Button
									>
								</Card.Content>
							</Card.Root>
						</div>
					</div>
				</Card.Content>
				<Card.Footer class="w-full flex-col items-end gap-2">
					<Button
						disabled={isLoading ||
							(name === originalName &&
								sprite === originalSprite &&
								description === originalDescription)}
						type="submit">{stores.t('profile.updateProfile')}</Button
					>
				</Card.Footer>
			</Card.Root>
		</form>

		<form onsubmit={onPrefsSave}>
			<Card.Root class="w-full">
				<Card.Header>
					<Card.Title>{stores.t('profile.accountPreferences')}</Card.Title>
					<Card.Description>{stores.t('profile.accountPreferencesDescription')}</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-col gap-6">
						<div class="flex flex-col gap-6">
							<div class="grid gap-2">
								<Label>{stores.t('profile.preferredLanguage')}</Label>
								<Select.Root type="single" name="locale" bind:value={selectedLocale}>
									<Select.Trigger class="w-[180px]">{languages[selectedLocale]}</Select.Trigger>
									<Select.Content>
										{#each locales as locale (locale)}
											<Select.Item value={locale} label={languages[locale]} />
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						</div>

						<div class="flex flex-col gap-6">
							<div class="flex items-start gap-3">
								<Checkbox id="vim-mode" bind:checked={vimModeEnabled} />
								<div class="grid gap-2">
									<Label for="vim-mode">{stores.t('profile.enableVim')}</Label>
									<p class="text-muted-foreground text-sm">
										{stores.t('profile.enableVimDescription')}
									</p>
								</div>
							</div>
						</div>
					</div>
				</Card.Content>
				<Card.Footer class="w-full flex-col items-end gap-2">
					<Button
						disabled={isLoadingPrefs ||
							(vimModeEnabled === originalVimModeEnabled &&
								selectedLocale === originalSelectedLocale)}
						type="submit">{stores.t('profile.updatePreferences')}</Button
					>
				</Card.Footer>
			</Card.Root>
		</form>
	</div>

	<h1 class="font-title mt-12 mb-6 flex-shrink-0 text-3xl">{stores.t('developer.settings')}</h1>
	<div class="flex flex-col gap-6">
		<Card.Root class="w-full">
			<Card.Header class="flex flex-row items-start justify-between gap-4">
				<div class="grid gap-1.5">
					<Card.Title>{stores.t('apps.title')}</Card.Title>
					<Card.Description>{stores.t('apps.description')}</Card.Description>
				</div>
				<Button onclick={() => (showCreateApp = true)} class="flex-shrink-0">
					<PlusIcon class="size-4" />
					{stores.t('apps.create')}
				</Button>
			</Card.Header>
			<Card.Content>
				{#if apps.length === 0}
					<div
						class="border-muted-foreground/25 flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed px-6 py-12 text-center"
					>
						<div
							class="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full"
						>
							<KeyIcon class="size-6" />
						</div>
						<p class="text-muted-foreground max-w-sm text-sm">{stores.t('apps.empty')}</p>
						<Button variant="outline" onclick={() => (showCreateApp = true)}>
							<PlusIcon class="size-4" />
							{stores.t('apps.create')}
						</Button>
					</div>
				{:else}
					<ul class="flex flex-col gap-2">
						{#each apps as app (app.$id)}
							<li
								class="flex items-center justify-between gap-4 rounded-md border p-3 transition-colors"
							>
								<div class="flex min-w-0 flex-col gap-1">
									<div class="flex items-center gap-2">
										<span class="truncate font-medium">{app.name}</span>
										{#if !app.enabled}
											<Badge variant="secondary">{stores.t('apps.enabled')}: ✗</Badge>
										{/if}
										<Badge variant="outline">{app.type}</Badge>
									</div>
									<span class="text-muted-foreground truncate font-mono text-xs">{app.$id}</span>
								</div>
								<div class="flex flex-shrink-0 items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onclick={() => goto(`/dashboard/settings/apps/${app.$id}`)}
									>
										<SettingsIcon class="size-4" />
										{stores.t('apps.manage')}
									</Button>
									<Button
										variant="ghost"
										size="icon"
										aria-label={stores.t('apps.delete')}
										onclick={() => (appToDelete = app.$id)}
									>
										<TrashIcon class="size-4" />
									</Button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>

<Dialog.Root bind:open={showCreateApp}>
	<Dialog.Content class="sm:max-w-[480px]">
		<form onsubmit={onCreateApp}>
			<Dialog.Header class="mb-4">
				<Dialog.Title>{stores.t('apps.createTitle')}</Dialog.Title>
				<Dialog.Description>{stores.t('apps.createDescription')}</Dialog.Description>
			</Dialog.Header>

			<div class="flex flex-col gap-4">
				<div class="grid gap-2">
					<Label for="app-name">{stores.t('apps.name')}</Label>
					<Input
						id="app-name"
						type="text"
						bind:value={appName}
						placeholder={stores.t('apps.namePlaceholder')}
						required
					/>
				</div>
				<div class="grid gap-2">
					<Label>{stores.t('apps.type')}</Label>
					<Select.Root type="single" name="app-type" bind:value={appType}>
						<Select.Trigger>
							{appType === 'public'
								? stores.t('apps.typePublic')
								: stores.t('apps.typeConfidential')}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="confidential" label={stores.t('apps.typeConfidential')} />
							<Select.Item value="public" label={stores.t('apps.typePublic')} />
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid gap-2">
					<Label for="app-redirect">{stores.t('apps.redirectUris')}</Label>
					<Textarea
						id="app-redirect"
						bind:value={appRedirectUris}
						placeholder="https://example.com/oauth/callback"
						rows={3}
					/>
					<p class="text-muted-foreground text-xs">{stores.t('apps.redirectUrisHint')}</p>
				</div>
				<div class="flex items-start gap-3">
					<Switch id="app-internal" bind:checked={appInternal} />
					<div class="grid gap-1">
						<Label for="app-internal">{stores.t('apps.internal')}</Label>
						<p class="text-muted-foreground text-sm">{stores.t('apps.internalHint')}</p>
					</div>
				</div>
			</div>

			<Dialog.Footer class="mt-6">
				<Button type="submit" disabled={isCreatingApp || !appName.trim()}>
					{stores.t('apps.create')}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	open={appToDelete !== null}
	onOpenChange={(open) => {
		if (!open) appToDelete = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{stores.t('apps.deleteTitle')}</AlertDialog.Title>
			<AlertDialog.Description>{stores.t('apps.deleteDescription')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{stores.t('ui.cancel')}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={onDeleteApp} disabled={isDeletingApp}>
				{stores.t('apps.delete')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root open={showEditor} onOpenChange={setShowEditor}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header class="mb-2">
			<Dialog.Title>{stores.t('profile.pictureEditor')}</Dialog.Title>
			<Dialog.Description>{stores.t('profile.pictureEditorDescription')}</Dialog.Description>
		</Dialog.Header>

		<Separator />

		<Paint bind:sprite />
		<Dialog.Footer>
			<Button type="button" onclick={() => setShowEditor(false)}
				>{stores.t('profile.closeEditor')}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
