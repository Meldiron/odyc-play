<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { Backend } from '$lib/backend';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Dependencies, OAUTH2_BASE } from '$lib/constants';
	import { stores } from '$lib/stores.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ImageUpIcon from '@lucide/svelte/icons/image-up';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const app = $derived(data.app);

	let name = $state(data.app.name);
	let type: 'confidential' | 'public' = $state(
		data.app.type === 'public' ? 'public' : 'confidential'
	);
	let redirectUris = $state(data.app.redirectUris.join('\n'));
	let enabled = $state(data.app.enabled);
	let deviceFlow = $state(data.app.deviceFlow);

	// Marketplace / consent metadata
	let tagline = $state(data.app.tagline ?? '');
	let description = $state(data.app.description ?? '');
	let clientUri = $state(data.app.clientUri ?? '');
	let supportUrl = $state(data.app.supportUrl ?? '');
	let privacyPolicyUrl = $state(data.app.privacyPolicyUrl ?? '');
	let termsUrl = $state(data.app.termsUrl ?? '');
	let dataDeletionUrl = $state(data.app.dataDeletionUrl ?? '');
	let contact = $state(data.app.contacts?.[0] ?? '');
	let category = $state(data.app.tags?.[0] ?? '');
	let logoUri = $state(data.app.logoUri ?? '');
	let imageUrls = $state<string[]>([...(data.app.images ?? [])]);

	let logoUploading = $state(false);
	let screenshotUploading = $state(false);

	let marketplaceOpen = $state(false);

	let isSaving = $state(false);

	function parseLines(value: string) {
		return value
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	}

	// App marketplace categories
	const CATEGORIES = [
		'Games',
		'Game development',
		'Productivity',
		'Artificial intelligence',
		'Education',
		'Art & design',
		'Entertainment',
		'Social',
		'Developer tools',
		'Utilities'
	];

	// OpenID Connect endpoints (same base as the configured Appwrite project)
	const oidcBase = OAUTH2_BASE;
	const oidcUrls = [
		{ label: 'apps.oidcDiscovery', url: `${oidcBase}/.well-known/openid-configuration` },
		{ label: 'apps.oidcAuthorization', url: `${oidcBase}/authorize` },
		{ label: 'apps.oidcToken', url: `${oidcBase}/token` },
		{ label: 'apps.oidcUserinfo', url: `${oidcBase}/userinfo` },
		{ label: 'apps.oidcJwks', url: `${oidcBase}/.well-known/jwks.json` }
	] as const;

	const hasChanges = $derived(
		name !== app.name ||
			type !== app.type ||
			enabled !== app.enabled ||
			deviceFlow !== app.deviceFlow ||
			redirectUris !== app.redirectUris.join('\n') ||
			tagline !== (app.tagline ?? '') ||
			description !== (app.description ?? '') ||
			logoUri !== (app.logoUri ?? '') ||
			clientUri !== (app.clientUri ?? '') ||
			supportUrl !== (app.supportUrl ?? '') ||
			privacyPolicyUrl !== (app.privacyPolicyUrl ?? '') ||
			termsUrl !== (app.termsUrl ?? '') ||
			dataDeletionUrl !== (app.dataDeletionUrl ?? '') ||
			contact !== (app.contacts?.[0] ?? '') ||
			category !== (app.tags?.[0] ?? '') ||
			imageUrls.join('\n') !== (app.images ?? []).join('\n')
	);

	// Image upload (logo + screenshots)
	const ACCEPTED_TYPES = ['image/png', 'image/jpeg'];
	const MAX_FILE_SIZE = 5 * 1024 * 1024;

	function readImageSize(file: File): Promise<{ width: number; height: number }> {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				URL.revokeObjectURL(url);
				resolve({ width: img.naturalWidth, height: img.naturalHeight });
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('read-error'));
			};
			img.src = url;
		});
	}

	// Returns the validated file's dimensions, or null if invalid (after showing a toast).
	async function validateImage(
		file: File,
		check: (size: { width: number; height: number }) => string | null
	) {
		if (!ACCEPTED_TYPES.includes(file.type)) {
			toast.error(stores.t('apps.imageTypeError'));
			return false;
		}
		if (file.size > MAX_FILE_SIZE) {
			toast.error(stores.t('apps.imageSizeError'));
			return false;
		}
		let size: { width: number; height: number };
		try {
			size = await readImageSize(file);
		} catch {
			toast.error(stores.t('apps.imageReadError'));
			return false;
		}
		const err = check(size);
		if (err) {
			toast.error(err);
			return false;
		}
		return true;
	}

	async function onLogoSelect(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		const valid = await validateImage(file, ({ width, height }) => {
			if (width !== height) return stores.t('apps.logoSquareError');
			if (width < 128 || width > 1024) return stores.t('apps.logoDimensionError');
			return null;
		});
		if (!valid) return;

		logoUploading = true;
		try {
			logoUri = await Backend.uploadAppLogo(file);
			toast.success(stores.t('apps.imageUploaded'));
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			logoUploading = false;
		}
	}

	async function onRemoveLogo() {
		const url = logoUri;
		logoUri = '';
		await Backend.deleteAppAsset('app-logos', url);
		toast.success(stores.t('apps.imageRemoved'));
	}

	async function onScreenshotSelect(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length === 0) return;

		screenshotUploading = true;
		try {
			for (const file of files) {
				const valid = await validateImage(file, ({ width, height }) => {
					if (width <= height) return stores.t('apps.screenshotLandscapeError');
					if (width < 1280 || height < 720) return stores.t('apps.screenshotHdError');
					return null;
				});
				if (!valid) continue;
				const url = await Backend.uploadAppScreenshot(file);
				imageUrls = [...imageUrls, url];
			}
			toast.success(stores.t('apps.imageUploaded'));
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			screenshotUploading = false;
		}
	}

	async function onRemoveScreenshot(index: number) {
		const url = imageUrls[index];
		imageUrls = imageUrls.filter((_, i) => i !== index);
		await Backend.deleteAppAsset('app-screenshots', url);
		toast.success(stores.t('apps.imageRemoved'));
	}

	async function onSave(event: Event) {
		event.preventDefault();
		isSaving = true;

		try {
			await Backend.updateApp(app.$id, {
				name,
				type,
				enabled,
				deviceFlow,
				redirectUris: parseLines(redirectUris),
				tagline,
				description,
				logoUri,
				clientUri,
				supportUrl,
				privacyPolicyUrl,
				termsUrl,
				dataDeletionUrl,
				contacts: contact.trim() ? [contact.trim()] : [],
				tags: category ? [category] : [],
				images: imageUrls
			});
			toast.success(stores.t('apps.updated'));
			await invalidate(Dependencies.APP);
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			isSaving = false;
		}
	}

	// Secrets
	let isCreatingSecret = $state(false);
	let newSecret = $state<string | null>(null);

	async function onCreateSecret() {
		isCreatingSecret = true;

		try {
			const secret = await Backend.createAppSecret(app.$id);
			newSecret = secret.secret;
			toast.success(stores.t('secrets.created'));
			await invalidate(Dependencies.APP);
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			isCreatingSecret = false;
		}
	}

	let secretToDelete = $state<string | null>(null);
	let isDeletingSecret = $state(false);

	async function onDeleteSecret() {
		if (!secretToDelete) return;
		isDeletingSecret = true;

		try {
			await Backend.deleteAppSecret(app.$id, secretToDelete);
			toast.success(stores.t('secrets.deleted'));
			secretToDelete = null;
			await invalidate(Dependencies.APP);
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			isDeletingSecret = false;
		}
	}

	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(stores.t('secrets.copied'));
		} catch (err: any) {
			toast.error(err.message);
		}
	}

	// Danger zone
	let isRevoking = $state(false);
	let showRevokeDialog = $state(false);

	async function onRevokeTokens() {
		isRevoking = true;

		try {
			await Backend.revokeAppTokens(app.$id);
			toast.success(stores.t('apps.tokensRevoked'));
			showRevokeDialog = false;
		} catch (err: any) {
			toast.error(err.message);
		} finally {
			isRevoking = false;
		}
	}

	let showDeleteDialog = $state(false);
	let isDeletingApp = $state(false);

	async function onDeleteApp() {
		isDeletingApp = true;

		try {
			await Backend.deleteApp(app.$id);
			toast.success(stores.t('apps.deleted'));
			await invalidate(Dependencies.APPS);
			await goto('/dashboard/settings');
		} catch (err: any) {
			toast.error(err.message);
			isDeletingApp = false;
		}
	}

	function formatDate(value?: string) {
		if (!value) return stores.t('secrets.never');
		return new Date(value).toLocaleString();
	}
</script>

<div class="mx-auto w-full max-w-4xl p-3">
	<Breadcrumb.Root class="my-6">
		<Breadcrumb.List>
			<Breadcrumb.Item>
				<Breadcrumb.Link href="/dashboard/settings">{stores.t('apps.backToApps')}</Breadcrumb.Link>
			</Breadcrumb.Item>
			<Breadcrumb.Separator />
			<Breadcrumb.Item>
				<Breadcrumb.Page>{app.name}</Breadcrumb.Page>
			</Breadcrumb.Item>
		</Breadcrumb.List>
	</Breadcrumb.Root>

	<div class="flex flex-col gap-6">
		<form onsubmit={onSave} class="flex flex-col gap-6">
				<Card.Root
					class="w-full overflow-hidden transition-colors {marketplaceOpen
						? ''
						: 'hover:bg-muted/40'}"
				>
					<button
						type="button"
						onclick={() => (marketplaceOpen = !marketplaceOpen)}
						aria-expanded={marketplaceOpen}
						class="flex w-full cursor-pointer items-center justify-between gap-4 px-6 text-left"
					>
						<div class="grid gap-1.5">
							<Card.Title>{stores.t('apps.marketplace')}</Card.Title>
							<Card.Description>{stores.t('apps.marketplaceDescription')}</Card.Description>
						</div>
						<ChevronDownIcon
							class="text-muted-foreground size-5 flex-shrink-0 transition-transform duration-200 {marketplaceOpen
								? 'rotate-180'
								: ''}"
						/>
					</button>
					{#if marketplaceOpen}
						<Card.Content>
							<div class="flex flex-col gap-6">
							<div class="grid gap-2">
								<Label for="app-tagline">{stores.t('apps.tagline')}</Label>
								<Input
									id="app-tagline"
									type="text"
									bind:value={tagline}
									placeholder={stores.t('apps.taglinePlaceholder')}
									maxlength={64}
								/>
								<p class="text-muted-foreground text-xs">{stores.t('apps.taglineHint')}</p>
							</div>

							<div class="grid gap-2">
								<Label for="app-description">{stores.t('apps.appDescription')}</Label>
								<Textarea
									id="app-description"
									bind:value={description}
									placeholder={stores.t('apps.appDescriptionPlaceholder')}
									rows={4}
								/>
							</div>

							<div class="grid gap-2">
								<Label for="app-homepage">{stores.t('apps.clientUri')}</Label>
								<Input
									id="app-homepage"
									type="url"
									bind:value={clientUri}
									placeholder="https://example.com"
								/>
							</div>

							<div class="grid gap-2">
								<Label>{stores.t('apps.logoUri')}</Label>
								{#if logoUri}
									<div class="relative w-fit">
										<img
											src={logoUri}
											alt=""
											class="bg-muted size-32 rounded-xl border object-cover"
										/>
										<Button
											type="button"
											variant="destructive"
											size="icon"
											class="absolute -top-2 -right-2 size-7 rounded-full"
											aria-label={stores.t('apps.removeImage')}
											onclick={onRemoveLogo}
										>
											<XIcon class="size-3.5" />
										</Button>
									</div>
								{:else}
									<label
										class="border-input hover:bg-muted/40 flex size-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-center transition-colors {logoUploading
											? 'pointer-events-none opacity-60'
											: ''}"
									>
										<input
											type="file"
											accept="image/png,image/jpeg"
											class="sr-only"
											disabled={logoUploading}
											onchange={onLogoSelect}
										/>
										{#if logoUploading}
											<LoaderCircleIcon class="text-muted-foreground size-5 animate-spin" />
										{:else}
											<ImageUpIcon class="text-muted-foreground size-5" />
											<span class="text-muted-foreground px-1 text-xs">
												{stores.t('apps.uploadClick')}
											</span>
										{/if}
									</label>
								{/if}
								<p class="text-muted-foreground text-xs">{stores.t('apps.logoUriHint')}</p>
							</div>

							<div class="grid gap-2">
								<Label>{stores.t('apps.tags')}</Label>
								<Select.Root type="single" bind:value={category}>
									<Select.Trigger class={category ? '' : 'text-muted-foreground'}>
										{category || stores.t('apps.categoryPlaceholder')}
									</Select.Trigger>
									<Select.Content>
										{#each CATEGORIES as cat (cat)}
											<Select.Item value={cat} label={cat} />
										{/each}
									</Select.Content>
								</Select.Root>
								<p class="text-muted-foreground text-xs">{stores.t('apps.tagsHint')}</p>
							</div>

							<div class="grid gap-2">
								<Label>{stores.t('apps.images')}</Label>
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
									{#each imageUrls as url, i (url)}
										<div class="relative aspect-video overflow-hidden rounded-lg border">
											<img src={url} alt="" class="bg-muted size-full object-cover" />
											<Button
												type="button"
												variant="destructive"
												size="icon"
												class="absolute top-1.5 right-1.5 size-7 rounded-full"
												aria-label={stores.t('apps.removeImage')}
												onclick={() => onRemoveScreenshot(i)}
											>
												<XIcon class="size-3.5" />
											</Button>
										</div>
									{/each}
									<label
										class="border-input hover:bg-muted/40 flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center transition-colors {screenshotUploading
											? 'pointer-events-none opacity-60'
											: ''}"
									>
										<input
											type="file"
											accept="image/png,image/jpeg"
											multiple
											class="sr-only"
											disabled={screenshotUploading}
											onchange={onScreenshotSelect}
										/>
										{#if screenshotUploading}
											<LoaderCircleIcon class="text-muted-foreground size-5 animate-spin" />
											<span class="text-muted-foreground text-xs">{stores.t('apps.uploading')}</span>
										{:else}
											<ImageUpIcon class="text-muted-foreground size-5" />
											<span class="text-muted-foreground px-1 text-xs">
												{stores.t('apps.uploadScreenshot')}
											</span>
										{/if}
									</label>
								</div>
								<p class="text-muted-foreground text-xs">{stores.t('apps.imagesHint')}</p>
							</div>

							<Separator />

							<div class="grid gap-6 sm:grid-cols-2">
								<div class="grid gap-2">
									<Label for="app-support">{stores.t('apps.supportUrl')}</Label>
									<Input
										id="app-support"
										type="url"
										bind:value={supportUrl}
										placeholder="https://example.com/support"
									/>
								</div>
								<div class="grid gap-2">
									<Label for="app-privacy">{stores.t('apps.privacyPolicyUrl')}</Label>
									<Input
										id="app-privacy"
										type="url"
										bind:value={privacyPolicyUrl}
										placeholder="https://example.com/privacy"
									/>
								</div>
								<div class="grid gap-2">
									<Label for="app-terms">{stores.t('apps.termsUrl')}</Label>
									<Input
										id="app-terms"
										type="url"
										bind:value={termsUrl}
										placeholder="https://example.com/terms"
									/>
								</div>
								<div class="grid gap-2">
									<Label for="app-data-deletion">{stores.t('apps.dataDeletionUrl')}</Label>
									<Input
										id="app-data-deletion"
										type="url"
										bind:value={dataDeletionUrl}
										placeholder="https://example.com/data-deletion"
									/>
								</div>
							</div>

							<div class="grid gap-2">
								<Label for="app-contacts">{stores.t('apps.contacts')}</Label>
								<Input
									id="app-contacts"
									type="email"
									bind:value={contact}
									placeholder="support@example.com"
								/>
							</div>
						</div>
					</Card.Content>
						<Card.Footer class="justify-end">
							<Button type="submit" disabled={isSaving || !hasChanges || !name.trim()}>
								{stores.t('apps.save')}
							</Button>
						</Card.Footer>
					{/if}
				</Card.Root>

			<Card.Root class="w-full">
				<Card.Header>
					<Card.Title>{stores.t('apps.details')}</Card.Title>
					<Card.Description>{stores.t('apps.detailsDescription')}</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-col gap-6">
						<div class="grid gap-2">
							<Label>{stores.t('apps.clientId')}</Label>
							<div class="flex items-center gap-2">
								<Input value={app.$id} readonly class="font-mono text-sm" />
								<Button
									type="button"
									variant="outline"
									size="icon"
									aria-label={stores.t('secrets.copy')}
									onclick={() => copy(app.$id)}
								>
									<CopyIcon class="size-4" />
								</Button>
							</div>
						</div>
						<div class="grid gap-2">
							<Label for="app-name">{stores.t('apps.name')}</Label>
							<Input
								id="app-name"
								type="text"
								bind:value={name}
								placeholder={stores.t('apps.namePlaceholder')}
								required
							/>
						</div>
						<div class="grid gap-2">
							<Label>{stores.t('apps.type')}</Label>
							<Select.Root type="single" name="app-type" bind:value={type}>
								<Select.Trigger>
									{type === 'public'
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
								bind:value={redirectUris}
								placeholder="https://example.com/oauth/callback"
								rows={3}
							/>
							<p class="text-muted-foreground text-xs">{stores.t('apps.redirectUrisHint')}</p>
						</div>
						<div class="flex items-start gap-3">
							<Switch id="app-enabled" bind:checked={enabled} />
							<div class="grid gap-1">
								<Label for="app-enabled">{stores.t('apps.enabled')}</Label>
								<p class="text-muted-foreground text-sm">{stores.t('apps.enabledHint')}</p>
							</div>
						</div>
						<div class="flex items-start gap-3">
							<Switch id="app-device-flow" bind:checked={deviceFlow} />
							<div class="grid gap-1">
								<Label for="app-device-flow">{stores.t('apps.deviceFlow')}</Label>
								<p class="text-muted-foreground text-sm">{stores.t('apps.deviceFlowHint')}</p>
							</div>
						</div>
					</div>
				</Card.Content>
				<Card.Footer class="justify-end">
					<Button type="submit" disabled={isSaving || !hasChanges || !name.trim()}>
						{stores.t('apps.save')}
					</Button>
				</Card.Footer>
				</Card.Root>
			</form>

		{#if app.type !== 'public'}
			<Card.Root class="w-full">
				<Card.Header class="flex flex-row items-start justify-between gap-4">
					<div class="grid gap-1.5">
						<Card.Title>{stores.t('secrets.title')}</Card.Title>
						<Card.Description>{stores.t('secrets.description')}</Card.Description>
					</div>
					<Button class="flex-shrink-0" disabled={isCreatingSecret} onclick={onCreateSecret}>
						<PlusIcon class="size-4" />
						{stores.t('secrets.create')}
					</Button>
				</Card.Header>
				<Card.Content>
					{#if app.secrets.length === 0}
						<p class="text-muted-foreground py-6 text-center text-sm">
							{stores.t('secrets.empty')}
						</p>
					{:else}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>{stores.t('secrets.secret')}</Table.Head>
									<Table.Head>{stores.t('secrets.createdBy')}</Table.Head>
									<Table.Head>{stores.t('secrets.lastUsed')}</Table.Head>
									<Table.Head class="text-right"></Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each app.secrets as secret (secret.$id)}
									<Table.Row>
										<Table.Cell class="font-mono">•••••{secret.hint}</Table.Cell>
										<Table.Cell>{secret.createdByName}</Table.Cell>
										<Table.Cell>{formatDate(secret.lastAccessedAt)}</Table.Cell>
										<Table.Cell class="text-right">
											<Button
												variant="ghost"
												size="icon"
												aria-label={stores.t('secrets.delete')}
												onclick={() => (secretToDelete = secret.$id)}
											>
												<TrashIcon class="size-4" />
											</Button>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root class="w-full">
			<Card.Header>
				<Card.Title>{stores.t('apps.advanced')}</Card.Title>
				<Card.Description>{stores.t('apps.advancedDescription')}</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-4">
					{#each oidcUrls as oidc (oidc.url)}
						<div class="grid gap-2">
							<Label>{stores.t(oidc.label)}</Label>
							<div class="flex items-center gap-2">
								<Input value={oidc.url} readonly class="font-mono text-sm" />
								<Button
									type="button"
									variant="outline"
									size="icon"
									aria-label={stores.t('secrets.copy')}
									onclick={() => copy(oidc.url)}
								>
									<CopyIcon class="size-4" />
								</Button>
							</div>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-destructive/50 w-full">
			<Card.Header>
				<Card.Title class="text-destructive">{stores.t('apps.dangerZone')}</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-6">
				<div class="flex items-center justify-between gap-4">
					<div class="grid gap-1">
						<Label>{stores.t('apps.revokeTokens')}</Label>
						<p class="text-muted-foreground text-sm">{stores.t('apps.revokeTokensDescription')}</p>
					</div>
					<Button variant="outline" class="flex-shrink-0" onclick={() => (showRevokeDialog = true)}>
						{stores.t('apps.revokeTokens')}
					</Button>
				</div>
				<Separator />
				<div class="flex items-center justify-between gap-4">
					<div class="grid gap-1">
						<Label>{stores.t('apps.delete')}</Label>
						<p class="text-muted-foreground text-sm">{stores.t('apps.deleteDescription')}</p>
					</div>
					<Button
						variant="destructive"
						class="flex-shrink-0"
						onclick={() => (showDeleteDialog = true)}
					>
						{stores.t('apps.delete')}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- Newly created secret -->
<Dialog.Root
	open={newSecret !== null}
	onOpenChange={(open) => {
		if (!open) newSecret = null;
	}}
>
	<Dialog.Content class="sm:max-w-[480px]">
		<Dialog.Header class="mb-2">
			<Dialog.Title>{stores.t('secrets.newSecretTitle')}</Dialog.Title>
			<Dialog.Description>{stores.t('secrets.newSecretDescription')}</Dialog.Description>
		</Dialog.Header>
		<div class="flex items-center gap-2">
			<Input value={newSecret} readonly class="font-mono text-sm" />
			<Button
				type="button"
				variant="outline"
				size="icon"
				aria-label={stores.t('secrets.copy')}
				onclick={() => copy(newSecret ?? '')}
			>
				<CopyIcon class="size-4" />
			</Button>
		</div>
		<Dialog.Footer class="mt-4">
			<Button type="button" onclick={() => (newSecret = null)}>{stores.t('secrets.done')}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete secret -->
<AlertDialog.Root
	open={secretToDelete !== null}
	onOpenChange={(open) => {
		if (!open) secretToDelete = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{stores.t('secrets.deleteTitle')}</AlertDialog.Title>
			<AlertDialog.Description>{stores.t('secrets.deleteDescription')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{stores.t('ui.cancel')}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={onDeleteSecret} disabled={isDeletingSecret}>
				{stores.t('secrets.delete')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Revoke tokens -->
<AlertDialog.Root bind:open={showRevokeDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{stores.t('apps.revokeTokens')}</AlertDialog.Title>
			<AlertDialog.Description>{stores.t('apps.revokeTokensDescription')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{stores.t('ui.cancel')}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={onRevokeTokens} disabled={isRevoking}>
				{stores.t('apps.revokeTokens')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Delete app -->
<AlertDialog.Root bind:open={showDeleteDialog}>
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
