<script lang="ts">
	let { data } = $props();

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
</script>

<svelte:head>
	<title>nomapples · Compare Apple prices across countries</title>
	<meta
		name="description"
		content="Compare Apple product prices across countries with live FX conversion for digital nomads."
	/>
</svelte:head>

<main>
	<header>
		<h1>nomapples</h1>
		<p>Where nomads buy Apple products smarter.</p>
		<small>
			FX base: USD, updated {data.ratesUpdatedAt}
			{#if data.rateSource === 'fallback'}
				(fallback rates)
			{/if}
		</small>
	</header>

	{#each data.products as product}
		<section>
			<div class="row-top">
				<h2>{product.name}</h2>
				<div class="badges">
					<span class="good">Cheapest: {product.cheapest.countryName}</span>
					<span class="warn">Most expensive: {product.priciest.countryName}</span>
				</div>
			</div>

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Country</th>
							<th>Local price</th>
							<th>USD normalized</th>
							<th>Delta vs cheapest</th>
						</tr>
					</thead>
					<tbody>
						{#each product.comparisons as row}
							<tr class:cheapest={row.deltaFromCheapestUSD === 0}>
								<td>{row.countryName} ({row.countryCode})</td>
								<td>{localMoney(row.localPrice, row.currency)}</td>
								<td>{usd.format(row.priceUSD)}</td>
								<td>
									{#if row.deltaFromCheapestUSD === 0}
										Best price
									{:else}
										+{usd.format(row.deltaFromCheapestUSD)}
										({row.deltaPercentFromCheapest.toFixed(1)}%)
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
		background: #0b1020;
		color: #e6edf7;
	}

	main {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
	}

	header h1 {
		margin: 0;
		font-size: 2.2rem;
	}

	header p {
		margin: 0.4rem 0;
		color: #b3c0d9;
	}

	header small {
		color: #8ea0c2;
	}

	section {
		margin-top: 1.5rem;
		border: 1px solid #233050;
		border-radius: 12px;
		padding: 1rem;
		background: #101934;
	}

	.row-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.row-top h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.badges {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.badges span {
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
	}

	.good {
		background: #123022;
		color: #9ef4c6;
	}

	.warn {
		background: #352611;
		color: #ffd29a;
	}

	.table-wrap {
		overflow-x: auto;
		margin-top: 0.8rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 680px;
	}

	th,
	td {
		text-align: left;
		padding: 0.65rem;
		border-bottom: 1px solid #233050;
		font-size: 0.95rem;
	}

	thead th {
		color: #b8c7e0;
		font-weight: 600;
	}

	tr.cheapest {
		background: #10281d;
	}
</style>
