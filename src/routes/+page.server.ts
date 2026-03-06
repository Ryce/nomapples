import type { PageServerLoad } from './$types';
import priceData from '$lib/data/prices.json';
import type { Country, PricingData, ProductComparison } from '$lib/types/pricing';
import { getUsdRates, toUsd } from '$lib/server/fx';

const FX_CACHE_KEY = 'https://nomapples.local/cache/fx-usd';
const FX_TTL_SECONDS = 60 * 60 * 6;

type PageVariant = {
	id: string;
	name: string;
	comparisons: ProductComparison[];
	cheapest: ProductComparison;
	priciest: ProductComparison;
};

type PageLine = {
	id: string;
	name: string;
	variants: PageVariant[];
};

type PageFamily = {
	id: string;
	name: string;
	lines: PageLine[];
};

type CachedFxPayload = {
	rates: Record<string, number>;
	updatedAt: string;
	source: 'live' | 'fallback';
};

async function getUsdRatesCached(fetchFn: typeof fetch): Promise<CachedFxPayload> {
	if (typeof caches === 'undefined' || !('default' in caches)) {
		return getUsdRates(fetchFn);
	}

	const cache = caches.default as Cache;
	const cacheRequest = new Request(FX_CACHE_KEY);
	const cached = await cache.match(cacheRequest);
	if (cached) {
		return (await cached.json()) as CachedFxPayload;
	}

	const fresh = await getUsdRates(fetchFn);
	await cache.put(
		cacheRequest,
		new Response(JSON.stringify(fresh), {
			headers: {
				'content-type': 'application/json',
				'cache-control': `public, max-age=${FX_TTL_SECONDS}`
			}
		})
	);

	return fresh;
}

function sortComparisons(countries: Country[], prices: Record<string, number>, rates: Record<string, number>) {
	const comparisons = countries
		.filter((country) => typeof prices[country.code] === 'number')
		.map((country) => {
			const localPrice = prices[country.code];
			const priceUSD = toUsd(localPrice, country.currency, rates);
			if (!Number.isFinite(priceUSD) || priceUSD <= 0) return null;

			return {
				countryCode: country.code,
				countryName: country.name,
				currency: country.currency,
				localPrice,
				priceUSD,
				deltaFromCheapestUSD: 0,
				deltaPercentFromCheapest: 0
			} satisfies ProductComparison;
		})
		.filter((row): row is ProductComparison => row !== null)
		.sort((a, b) => a.priceUSD - b.priceUSD);

	const cheapestUsd = comparisons[0]?.priceUSD ?? 0;

	return comparisons.map((row) => ({
		...row,
		deltaFromCheapestUSD: row.priceUSD - cheapestUsd,
		deltaPercentFromCheapest: cheapestUsd > 0 ? ((row.priceUSD - cheapestUsd) / cheapestUsd) * 100 : 0
	}));
}

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	const { rates, updatedAt, source } = await getUsdRatesCached(fetch);
	const data = priceData as PricingData;

	const families: PageFamily[] = data.families.map((family) => ({
		id: family.id,
		name: family.name,
		lines: family.lines.map((line) => ({
			id: line.id,
			name: line.name,
			variants: line.variants.map((variant) => {
				const comparisons = sortComparisons(data.countries, variant.prices, rates);
				return {
					id: variant.id,
					name: variant.name,
					comparisons,
					cheapest: comparisons[0],
					priciest: comparisons[comparisons.length - 1]
				};
			})
		}))
	}));

	setHeaders({
		'cache-control': 'public, max-age=180'
	});

	return {
		ratesUpdatedAt: updatedAt,
		rateSource: source,
		families
	};
};
