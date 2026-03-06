<script lang="ts">
	let { data } = $props();

	type ViewMode = 'cards' | 'table';

	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});

	function localMoney(value: number, currency: string) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
			maximumFractionDigits: 0
		}).format(value);
	}

	let selectedFamilyId = $state('');
	$effect(() => {
		if (!selectedFamilyId) selectedFamilyId = data.families[0]?.id ?? '';
	});
	const selectedFamily = $derived(
		data.families.find((f: (typeof data.families)[number]) => f.id === selectedFamilyId) ?? data.families[0]
	);

	let selectedLineId = $state('');
	$effect(() => {
		const firstLineId = selectedFamily?.lines[0]?.id ?? '';
		if (!selectedFamily?.lines.some((l: (typeof selectedFamily.lines)[number]) => l.id === selectedLineId)) {
			selectedLineId = firstLineId;
		}
	});

	const selectedLine = $derived(
		selectedFamily?.lines.find((l: (typeof selectedFamily.lines)[number]) => l.id === selectedLineId) ??
			selectedFamily?.lines[0]
	);

	let selectedVariantId = $state('');
	$effect(() => {
		const firstVariantId = selectedLine?.variants[0]?.id ?? '';
		if (
			!selectedLine?.variants.some((v: (typeof selectedLine.variants)[number]) => v.id === selectedVariantId)
		) {
			selectedVariantId = firstVariantId;
		}
	});

	const selectedVariant = $derived(
		selectedLine?.variants.find((v: (typeof selectedLine.variants)[number]) => v.id === selectedVariantId) ??
			selectedLine?.variants[0]
	);

	let viewMode = $state<ViewMode>('cards');
	let showLocalPrice = $state(true);

	const priceMin = $derived(selectedVariant?.cheapest?.priceUSD ?? 0);
	const priceMax = $derived(selectedVariant?.priciest?.priceUSD ?? 0);
	const maxSpread = $derived((selectedVariant?.priciest?.priceUSD ?? 0) - (selectedVariant?.cheapest?.priceUSD ?? 0));
</script>

<svelte:head>
	<title>nomapples · Compare Apple prices across countries</title>
	<meta
		name="description"
		content="Compare Apple product prices across countries with live FX conversion for digital nomads."
	/>
</svelte:head>

<main class="container">
	<section class="hero card">
		<p class="eyebrow">Nomad Apple Price Intelligence</p>
		<h1>Where nomads buy Apple products smarter.</h1>
		<p class="sub">Family → line → variant. Then compare country pricing instantly.</p>
		<div class="meta">
			<span>FX base: USD</span>
			<span>Updated: {data.ratesUpdatedAt}</span>
			{#if data.rateSource === 'fallback'}
				<span class="fallback">Using fallback FX rates</span>
			{/if}
		</div>
	</section>

	<section class="selectors card">
		<div>
			<p class="label">1) Family</p>
			<div class="chip-row">
				{#each data.families as family}
					<button class:active={selectedFamilyId === family.id} onclick={() => (selectedFamilyId = family.id)}>
						{family.name}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<p class="label">2) Line</p>
			<div class="chip-row">
				{#each selectedFamily?.lines ?? [] as line}
					<button class:active={selectedLineId === line.id} onclick={() => (selectedLineId = line.id)}>
						{line.name}
					</button>
				{/each}
			</div>
		</div>

		<div class="variant-row">
			<label>
				3) Variant
				<select bind:value={selectedVariantId}>
					{#each selectedLine?.variants ?? [] as variant}
						<option value={variant.id}>{variant.name}</option>
					{/each}
				</select>
			</label>

			<label>
				View
				<select bind:value={viewMode}>
					<option value="cards">Cards</option>
					<option value="table">Table</option>
				</select>
			</label>

			<label class="toggle">
				<input type="checkbox" bind:checked={showLocalPrice} />
				<span>Show local</span>
			</label>
		</div>
	</section>

	<section class="stats-grid">
		<article class="stat card">
			<p>Cheapest</p>
			<h2>{selectedVariant?.cheapest?.countryName}</h2>
			<strong>{usd.format(selectedVariant?.cheapest?.priceUSD ?? 0)}</strong>
		</article>
		<article class="stat card">
			<p>Most expensive</p>
			<h2>{selectedVariant?.priciest?.countryName}</h2>
			<strong>{usd.format(selectedVariant?.priciest?.priceUSD ?? 0)}</strong>
		</article>
		<article class="stat card">
			<p>Max spread</p>
			<h2>Savings opportunity</h2>
			<strong>{usd.format(maxSpread)}</strong>
		</article>
	</section>

	{#if viewMode === 'cards'}
		<section class="card-list">
			{#each selectedVariant?.comparisons ?? [] as row, idx}
				<article class="price-card card" class:best={row.deltaFromCheapestUSD === 0}>
					<div class="price-head">
						<div>
							<h3>#{idx + 1} {row.countryName}</h3>
							<p>{row.countryCode} · {row.currency}</p>
						</div>
						<strong>{usd.format(row.priceUSD)}</strong>
					</div>

					<div class="spread">
						<div
							class="spread-fill"
							style={`width: ${priceMax > priceMin ? ((row.priceUSD - priceMin) / (priceMax - priceMin)) * 100 : 0}%`}
						></div>
					</div>

					<div class="price-foot">
						{#if row.deltaFromCheapestUSD === 0}
							<span class="badge-good">Best price</span>
						{:else}
							<span>+{usd.format(row.deltaFromCheapestUSD)} ({row.deltaPercentFromCheapest.toFixed(1)}%)</span>
						{/if}
						{#if showLocalPrice}
							<span>{localMoney(row.localPrice, row.currency)}</span>
						{/if}
					</div>
				</article>
			{/each}
		</section>
	{:else}
		<section class="table-wrap card">
			<table>
				<thead>
					<tr>
						<th>Country</th>
						{#if showLocalPrice}<th>Local</th>{/if}
						<th>USD</th>
						<th>Delta vs cheapest</th>
					</tr>
				</thead>
				<tbody>
					{#each selectedVariant?.comparisons ?? [] as row}
						<tr class:best={row.deltaFromCheapestUSD === 0}>
							<td>{row.countryName} ({row.countryCode})</td>
							{#if showLocalPrice}<td>{localMoney(row.localPrice, row.currency)}</td>{/if}
							<td>{usd.format(row.priceUSD)}</td>
							<td>
								{#if row.deltaFromCheapestUSD === 0}
									Best price
								{:else}
									+{usd.format(row.deltaFromCheapestUSD)} ({row.deltaPercentFromCheapest.toFixed(1)}%)
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
		background: #f3f5f8;
		color: #111827;
	}

	.container {
		max-width: 1080px;
		margin: 0 auto;
		padding: 1rem 1rem 2rem;
		display: grid;
		gap: 1rem;
	}

	.card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 16px;
		padding: 1rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #4b5563;
		font-weight: 600;
	}

	.hero h1 {
		margin: 0.2rem 0 0;
		font-size: clamp(1.6rem, 5vw, 2.2rem);
		line-height: 1.1;
	}

	.sub {
		margin: 0.7rem 0 0;
		color: #374151;
	}

	.meta {
		margin-top: 0.8rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.meta span {
		font-size: 0.8rem;
		padding: 0.35rem 0.55rem;
		border-radius: 999px;
		background: #f3f4f6;
	}

	.fallback {
		background: #fff7ed;
		color: #9a3412;
	}

	.label {
		margin: 0 0 0.4rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: #4b5563;
	}

	.chip-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.chip-row button {
		border: 1px solid #d1d5db;
		background: #fff;
		color: #111827;
		padding: 0.46rem 0.7rem;
		border-radius: 999px;
		cursor: pointer;
		font-weight: 600;
	}

	.chip-row button.active {
		background: #111827;
		color: #fff;
		border-color: #111827;
	}

	.selectors {
		display: grid;
		gap: 0.9rem;
	}

	.variant-row {
		display: flex;
		gap: 0.7rem;
		flex-wrap: wrap;
		align-items: end;
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.82rem;
		color: #4b5563;
	}

	select {
		border: 1px solid #d1d5db;
		border-radius: 10px;
		padding: 0.5rem 0.65rem;
		background: #fff;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding-bottom: 0.3rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(1, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.stat p {
		margin: 0;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.stat h2 {
		margin: 0.25rem 0;
		font-size: 1rem;
	}

	.stat strong {
		font-size: 1.4rem;
	}

	.card-list {
		display: grid;
		gap: 0.75rem;
	}

	.price-card.best {
		border-color: #22c55e;
	}

	.price-head {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 0.75rem;
	}

	.price-head h3 {
		margin: 0;
		font-size: 1rem;
	}

	.price-head p {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.price-head strong {
		font-size: 1.2rem;
	}

	.spread {
		margin-top: 0.7rem;
		height: 8px;
		border-radius: 999px;
		background: #eef2f7;
		overflow: hidden;
	}

	.spread-fill {
		height: 100%;
		background: linear-gradient(90deg, #10b981, #ef4444);
		min-width: 10px;
	}

	.price-foot {
		margin-top: 0.7rem;
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.86rem;
		color: #374151;
	}

	.badge-good {
		background: #ecfdf3;
		color: #166534;
		border-radius: 999px;
		padding: 0.25rem 0.55rem;
		font-weight: 600;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 700px;
	}

	th,
	td {
		padding: 0.7rem;
		text-align: left;
		border-bottom: 1px solid #e5e7eb;
	}

	th {
		font-size: 0.82rem;
		color: #6b7280;
	}

	tr.best {
		background: #f0fdf4;
	}

	@media (min-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
