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
	import { Dependencies } from '$lib/constants';
	import { stores } from '$lib/stores.svelte';
	import CopyIcon from '@lucide/svelte/icons/copy';
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
	let internal = $state(data.app.internal);

	let isSaving = $state(false);

	function parseRedirectUris(value: string) {
		return value
			.split('\n')
			.map((uri) => uri.trim())
			.filter((uri) => uri.length > 0);
	}

	const hasChanges = $derived(
		name !== app.name ||
			type !== app.type ||
			enabled !== app.enabled ||
			internal !== app.internal ||
			redirectUris !== app.redirectUris.join('\n')
	);

	async function onSave(event: Event) {
		event.preventDefault();
		isSaving = true;

		try {
			await Backend.updateApp(app.$id, {
				name,
				type,
				enabled,
				internal,
				redirectUris: parseRedirectUris(redirectUris)
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
		<form onsubmit={onSave}>
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
							<Switch id="app-internal" bind:checked={internal} />
							<div class="grid gap-1">
								<Label for="app-internal">{stores.t('apps.internal')}</Label>
								<p class="text-muted-foreground text-sm">{stores.t('apps.internalHint')}</p>
							</div>
						</div>
					</div>
				</Card.Content>
				<Card.Footer class="w-full flex-col items-end gap-2">
					<Button type="submit" disabled={isSaving || !hasChanges || !name.trim()}>
						{stores.t('apps.save')}
					</Button>
				</Card.Footer>
			</Card.Root>
		</form>

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
					<p class="text-muted-foreground py-6 text-center text-sm">{stores.t('secrets.empty')}</p>
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
									<Table.Cell class="font-mono">•••••{secret.secret}</Table.Cell>
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
					<Button
						variant="outline"
						class="flex-shrink-0"
						onclick={() => (showRevokeDialog = true)}
					>
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
