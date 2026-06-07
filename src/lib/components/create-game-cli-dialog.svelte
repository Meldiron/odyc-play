<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { stores } from '$lib/stores.svelte';
	import IconTerminal2 from '@tabler/icons-svelte/icons/terminal-2';
	import IconClipboard from '@tabler/icons-svelte/icons/clipboard';
	import IconCheck from '@tabler/icons-svelte/icons/check';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const docsUrl = 'https://github.com/Meldiron/odyc-cli';

	type Step = {
		titleKey: Parameters<typeof stores.t>[0];
		descriptionKey: Parameters<typeof stores.t>[0];
		commands: string[];
	};

	const steps: Step[] = [
		{
			titleKey: 'cli.step1Title',
			descriptionKey: 'cli.step1Description',
			commands: ['go install github.com/meldiron/odyc-cli@latest', 'odyc-cli login']
		},
		{
			titleKey: 'cli.step2Title',
			descriptionKey: 'cli.step2Description',
			commands: ['odyc-cli create my-game']
		},
		{
			titleKey: 'cli.step3Title',
			descriptionKey: 'cli.step3Description',
			commands: ['cd my-game', 'open index.html']
		},
		{
			titleKey: 'cli.step4Title',
			descriptionKey: 'cli.step4Description',
			commands: ['odyc-cli deploy']
		}
	];

	let copiedKey = $state<string | null>(null);
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	function copy(command: string, key: string) {
		navigator.clipboard.writeText(command);
		copiedKey = key;
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			copiedKey = null;
			timeoutId = undefined;
		}, 1200);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="gap-0 p-0 sm:max-w-xl" data-cli-dialog>
		<!-- Header -->
		<div class="flex items-start gap-4 border-b p-6">
			<div
				class="bg-primary text-primary-foreground flex size-11 flex-shrink-0 items-center justify-center rounded-lg"
			>
				<IconTerminal2 class="size-6" />
			</div>
			<div class="min-w-0 space-y-1">
				<Dialog.Title class="font-title text-2xl font-light"
					>{stores.t('cli.title')}</Dialog.Title
				>
				<Dialog.Description class="text-sm leading-relaxed">
					{stores.t('cli.subtitle')}
				</Dialog.Description>
			</div>
		</div>

		<!-- Steps timeline -->
		<ol class="relative flex flex-col gap-6 p-6">
			{#each steps as step, i (step.titleKey)}
				<li class="relative flex gap-4">
					<!-- Connector line + number -->
					<div class="flex flex-col items-center">
						<span
							class="bg-muted text-foreground ring-border z-10 flex size-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1"
						>
							{i + 1}
						</span>
						{#if i < steps.length - 1}
							<span class="bg-border mt-1 w-px flex-1"></span>
						{/if}
					</div>

					<!-- Content -->
					<div class="min-w-0 flex-1 pb-1">
						<h3 class="text-sm font-semibold">{stores.t(step.titleKey)}</h3>
						<p class="text-muted-foreground mt-0.5 text-xs leading-relaxed">
							{stores.t(step.descriptionKey)}
						</p>

						<!-- Terminal command block -->
						<div class="bg-foreground text-background mt-2.5 flex flex-col rounded-md font-mono text-xs">
							{#each step.commands as command, j (command)}
								{@const key = `${i}-${j}`}
								<div
									class="border-background/10 flex items-center gap-2 py-2 pr-2 pl-3 not-first:border-t"
								>
									<span class="text-background/40 select-none">$</span>
									<code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{command}</code>
									<button
										type="button"
										onclick={() => copy(command, key)}
										title={copiedKey === key ? stores.t('cli.copied') : stores.t('cli.copy')}
										aria-label={stores.t('cli.copy')}
										class="text-background/60 hover:bg-background/10 hover:text-background flex size-7 flex-shrink-0 items-center justify-center rounded transition-colors"
									>
										{#if copiedKey === key}
											<IconCheck class="size-4" />
										{:else}
											<IconClipboard class="size-4" />
										{/if}
									</button>
								</div>
							{/each}
						</div>
					</div>
				</li>
			{/each}
		</ol>

		<!-- Footer -->
		<div class="border-t p-4">
			<a
				href={docsUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
			>
				<IconExternalLink class="size-4" />
				{stores.t('cli.docsLink')}
			</a>
		</div>
	</Dialog.Content>
</Dialog.Root>
