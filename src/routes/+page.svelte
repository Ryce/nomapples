<script lang="ts">
	let { data } = $props();

	type ViewMode = 'cards' | 'table';
	type SortMode = 'usd-asc' | 'usd-desc' | 'delta-asc' | 'delta-desc';

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

	const initialProductId = data.products[0]?.id ?? '';
	let selectedProductId = $state(initialProductId);
	let viewMode = $state<ViewMode>('cards');
	let sortMode = $state<SortMode>('usd-asc');
	let showLocalPrice = $state(true);

	const selectedProduct = $derived(
		data.products.find((p: (typeof data.products)[number]) => p.id === selectedProductId) ?? data.products[0]
	);

	const sortedComparisons = $derived.by(() => {
		const list = [...(selectedProduct?.comparisons ?? [])];
		switch (sortMode) {
			case 'usd-desc':
				return list.sort((a, b) => b.priceUSD - a.priceUSD);
			case 'delta-asc':
				return list.sort((a, b) => a.deltaFromCheapestUSD - b.deltaFromCheapestUSD);
			case 'delta-desc':
				return list.sort((a, b) => b.deltaFromCheapestUSD - a.deltaFromCheapestUSD);
			case 'usd-asc':
			default:
				return list.sort((a, b) => a.priceUSD - b.priceUSD);
		}
	});

	const priceMin = $derived(selectedProduct?.cheapest?.priceUSD ?? 0);
	const priceMax = $derived(selectedProduct?.priciest?.priceUSD ?? 0);
	const maxSpread = $derived((selectedProduct?.priciest?.priceUSD ?? 0) - (selectedProduct?.cheapest?.priceUSD ?? 0));
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
		<div>
			<p class="eyebrow">Nomad Apple Price Intelligence</p>
			<h1>Where nomads buy Apple products smarter.</h1>
			<p class="sub">
				Instantly compare country pricing with USD normalization and see where the real savings are.
			</p>
		</div>
		<div class="meta">
			<span>FX base: USD</span>
			<span>Updated: {data.ratesUpdatedAt}</span>
			{#if data.rateSource === 'fallback'}
				<span class="fallback">Using fallback FX rates</span>
			{/if}
		</div>
	</section>

	<section class="controls card">
		<div class="product-switcher" role="tablist" aria-label="Product selector">
			{#each data.products as product}
				<button
					class:active={selectedProductId === product.id}
					onclick={() => (selectedProductId = product.id)}
					role="tab"
					aria-selected={selectedProductId === product.id}
				>
					{product.name}
				</button>
			{/each}
		</div>

		<div class="control-row">
			<label>
				Sort
				<select bind:value={sortMode}>
					<option value="usd-asc">USD, lowest first</option>
					<option value="usd-desc">USD, highest first</option>
					<option value="delta-asc">Delta, lowest first</option>
					<option value="delta-desc">Delta, highest first</option>
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
				<span>Show local prices</span>
			</label>
		</div>
	</section>

	<section class="stats-grid">
		<article class="stat card">
			<p>Cheapest</p>
			<h2>{selectedProduct?.cheapest?.countryName}</h2>
			<strong>{usd.format(selectedProduct?.cheapest?.priceUSD ?? 0)}</strong>
		</article>
		<article class="stat card">
			<p>Most expensive</p>
			<h2>{selectedProduct?.priciest?.countryName}</h2>
			<strong>{usd.format(selectedProduct?.priciest?.priceUSD ?? 0)}</strong>
		</article>
		<article class="stat card">
			<p>Max spread</p>
			<h2>Savings opportunity</h2>
			<strong>{usd.format(maxSpread)}</strong>
		</article>
	</section>

	{#if viewMode === 'cards'}
		<section class="card-list">
			{#each sortedComparisons as row, idx}
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
					{#each sortedComparisons as row}
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

	<section class="method-note card">
		<h3>How these numbers are calculated</h3>
		<p>
			We normalize local Apple pricing to USD using daily FX rates, then rank each country by effective USD cost.
			This is directional pricing intelligence, not checkout-level tax and import advice.
		</p>
	</section>

	<div class="mobile-sticky card">
		<select bind:value={selectedProductId}>
			{#each data.products as product}
				<option value={product.id}>{product.name}</option>
			{/each}
		</select>
		<select bind:value={sortMode}>
			<option value="usd-asc">Lowest</option>
			<option value="usd-desc">Highest</option>
			<option value="delta-asc">Tightest delta</option>
			<option value="delta-desc">Widest delta</option>
		</select>
		<button onclick={() => (viewMode = viewMode === 'cards' ? 'table' : 'cards')}>
			{viewMode === 'cards' ? 'Table' : 'Cards'}
		</button>
	</div>
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
		padding: 1rem 1rem 6rem;
		display: grid;
		gap: 1rem;
	}

	.card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 16px;
		padding: 1rem;
	}

	.hero h1 {
		margin: 0.2rem 0 0;
		font-size: clamp(1.6rem, 5vw, 2.2rem);
		line-height: 1.1;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #4b5563;
		font-weight: 600;
	}

	.sub {
		margin: 0.75rem 0 0;
		color: #374151;
	}

	.meta {
		margin-top: 1rem;
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

	.product-switcher {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.product-switcher button {
		border: 1px solid #d1d5db;
		background: #fff;
		color: #111827;
		padding: 0.5rem 0.75rem;
		border-radius: 999px;
		cursor: pointer;
		font-weight: 600;
	}

	.product-switcher button.active {
		background: #111827;
		color: #fff;
		border-color: #111827;
	}

	.control-row {
		margin-top: 0.8rem;
		display: flex;
		gap: 0.75rem;
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
		padding-bottom: 0.35rem;
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

	.method-note h3 {
		margin: 0;
	}

	.method-note p {
		color: #4b5563;
		margin: 0.55rem 0 0;
	}

	.mobile-sticky {
		position: fixed;
		left: 0.75rem;
		right: 0.75rem;
		bottom: 0.75rem;
		display: grid;
		grid-template-columns: 1.2fr 1fr auto;
		gap: 0.5rem;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.14);
	}

	.mobile-sticky button {
		border: none;
		background: #111827;
		color: #fff;
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		font-weight: 600;
	}

	@media (min-width: 768px) {
		.container {
			padding: 1.25rem 1.25rem 2rem;
		}

		.stats-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.mobile-sticky {
			display: none;
		}
	}
</style>
