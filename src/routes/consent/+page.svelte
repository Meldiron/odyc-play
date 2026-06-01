<script lang="ts">
	import { onMount } from 'svelte';
	import { type Models } from 'appwrite';
	import { Backend } from '$lib/backend';
	import { stores } from '$lib/stores.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as InputOTP from '$lib/components/ui/input-otp/index.js';
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import CheckIcon from '@lucide/svelte/icons/check';
	import IconGhost from '@lucide/svelte/icons/ghost';
	import IconGitHub from '@lucide/svelte/icons/github';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Situation B: a grant exists and the user must give explicit consent.
	const showConsent = $derived(!!data.grantId);
	// Situation A: no grant yet. If already logged in we bounce straight back to
	// /authorize; otherwise we must sign the user in first.
	const showLogin = $derived(!data.grantId && !data.isLoggedIn);
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

	// --- Login (Situation A) ---
	let isLoading = $state(false);
	let email = $state('');
	let otp = $state('');
	let error = $state<any>(null);
	let token = $state<null | Models.Token>(null);
	let step = $state<1 | 2>(1);

	function finishLogin() {
		// Re-enter the OAuth2 flow now that a session exists.
		window.location.href = data.authorizeUrl;
	}

	async function onMagicSignIn(event: Event) {
		event.preventDefault();
		isLoading = true;
		error = null;

		if (!token) {
			try {
				token = await Backend.signInMagicURL(email);
				step = 2;
				toast.success(stores.t('auth.emailSent'));
			} catch (err: any) {
				error = err;
			} finally {
				isLoading = false;
			}
		} else {
			try {
				await Backend.signInFinish(token?.userId ?? '', otp);
				finishLogin();
			} catch (err: any) {
				error = err;
				isLoading = false;
			}
		}
	}

	function onStepBack() {
		step = 1;
		email = '';
		otp = '';
		token = null;
		error = null;
	}

	async function onGuestSignIn() {
		isLoading = true;
		error = null;
		try {
			await Backend.signInAnonymous();
			finishLogin();
		} catch (err: any) {
			error = err;
			isLoading = false;
		}
	}

	function onGitHubSignIn() {
		isLoading = true;
		Backend.signInGitHub(data.returnPath); // Redirects away
	}
</script>

<div class="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
	<div class="w-full max-w-sm">
		<div class="flex flex-col items-center gap-2">
			<a href="/" class="flex flex-col items-center gap-2 font-medium">
				<div class="flex items-center justify-center rounded-md">
					<img src="/logo.png" class="pixelated size-12" alt="Odyc.js Play Logo" />
				</div>
			</a>
		</div>

		{#if redirecting}
			<p class="text-muted-foreground mt-6 text-center text-sm">
				{stores.t('consent.redirecting')}
			</p>
		{:else if showConsent}
			<!-- Situation B: consent UI -->
			<div class="mt-4 flex flex-col gap-6">
				<div class="flex flex-col items-center gap-2 text-center">
					<h1 class="text-xl font-bold">{stores.t('consent.heading')}</h1>
					<p class="text-muted-foreground text-sm">
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
		{:else if showLogin}
			<!-- Situation A: authenticate, then re-enter /authorize -->
			<form onsubmit={onMagicSignIn}>
				<div class="mt-4 flex flex-col gap-6">
					<div class="flex flex-col items-center gap-2 text-center">
						<h1 class="text-xl font-bold">{stores.t('consent.signInHeading')}</h1>
						<p class="text-muted-foreground text-sm">{stores.t('consent.signInDescription')}</p>
					</div>

					<Separator />

					{#if step === 1}
						<div class="flex flex-col gap-6">
							<div class="grid gap-3">
								<Label for="login-email">{stores.t('auth.email')}</Label>
								<Input
									bind:value={email}
									id="login-email"
									type="text"
									placeholder="your@email.com"
									required
								/>
							</div>
							<Button disabled={isLoading} type="submit" class="w-full">
								{stores.t('auth.signIn')}
							</Button>
						</div>
					{:else if step === 2}
						<div class="flex flex-col items-center gap-6">
							<div class="grid gap-3">
								<InputOTP.Root
									bind:value={otp}
									class="w-full"
									pattern={REGEXP_ONLY_DIGITS}
									maxlength={6}
								>
									{#snippet children({ cells })}
										<InputOTP.Group>
											{#each cells.slice(0, 3) as cell (cell)}
												<InputOTP.Slot {cell} />
											{/each}
										</InputOTP.Group>
										<InputOTP.Separator />
										<InputOTP.Group>
											{#each cells.slice(3, 6) as cell (cell)}
												<InputOTP.Slot {cell} />
											{/each}
										</InputOTP.Group>
									{/snippet}
								</InputOTP.Root>
							</div>
							<div class="flex w-full flex-col justify-center">
								<Button disabled={isLoading} type="submit" class="w-full">
									{stores.t('auth.continue')}
								</Button>
								<button type="button" onclick={onStepBack}>
									<p class="text-muted-foreground mt-3 text-center text-sm underline">
										Didn't receive the code?
									</p>
								</button>
							</div>
						</div>
					{/if}

					{#if error}
						<Alert.Root variant="destructive">
							<AlertCircleIcon />
							<Alert.Description class="text-destructive">{error.message}</Alert.Description>
						</Alert.Root>
					{/if}

					<div
						class="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t"
					>
						<span class="bg-background text-muted-foreground relative z-10 px-2">
							{stores.t('auth.or')}
						</span>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<Button
							disabled={isLoading}
							onclick={onGuestSignIn}
							variant="outline"
							type="button"
							class="!disabled:opacity-50 w-full border-dashed !bg-transparent"
						>
							<IconGhost />
							{stores.t('auth.anonymousContinue')}
						</Button>
						<Button
							disabled={isLoading}
							onclick={onGitHubSignIn}
							variant="outline"
							type="button"
							class="w-full"
						>
							<IconGitHub />
							Continue with GitHub
						</Button>
					</div>
				</div>
			</form>
		{:else}
			<p class="text-muted-foreground mt-6 text-center text-sm">
				{stores.t('consent.invalidRequest')}
			</p>
		{/if}
	</div>
</div>
