<script lang="ts">
	import { stores } from '$lib/stores.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
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
				<div class="flex flex-col items-center gap-6 text-center">
					<!-- Concentric green halo around a solid check badge — a familiar "done" cue. -->
					<div class="flex size-24 items-center justify-center rounded-full bg-green-500/10">
						<div class="flex size-16 items-center justify-center rounded-full bg-green-500/15">
							<div
								class="flex size-12 items-center justify-center rounded-full bg-green-600 text-white shadow-sm dark:bg-green-500"
							>
								<CheckIcon class="size-7" strokeWidth={3} />
							</div>
						</div>
					</div>

					<div class="flex flex-col items-center gap-2">
						<h1 class="text-xl font-bold">{stores.t('deviceSuccess.heading')}</h1>
						<p class="text-muted-foreground max-w-[300px] text-sm text-balance">
							{stores.t('deviceSuccess.description')}
						</p>
					</div>

					<Button href="/" class="w-full">
						{stores.t('deviceSuccess.home')}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
