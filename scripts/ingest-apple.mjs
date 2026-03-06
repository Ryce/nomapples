#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'src', 'lib', 'data');
const jurisdictionsPath = path.join(dataDir, 'jurisdictions.json');
const pricesPath = path.join(dataDir, 'prices.json');
const reportPath = path.join(rootDir, 'ingestion-report.md');

const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const VARIANT_SPECS = {
	'macbook-air-13-m3-16-512': {
		path: '/shop/buy-mac/macbook-air',
		requiredAny: [['13', '13-inch', '13inch'], ['16gb'], ['512gb']],
		forbidden: []
	},
	'macbook-pro-14-m4pro-18-512': {
		path: '/shop/buy-mac/macbook-pro',
		requiredAny: [['14', '14-inch', '14inch'], ['18gb'], ['512gb'], ['m4']],
		forbidden: []
	},
	'mac-mini-m4-16-512': {
		path: '/shop/buy-mac/mac-mini',
		requiredAny: [['16gb'], ['512gb'], ['m4']],
		forbidden: []
	},
	'iphone-16-128': {
		path: '/shop/buy-iphone/iphone-16',
		requiredAny: [['128gb']],
		forbidden: ['pro', 'plus']
	},
	'iphone-16-pro-128': {
		path: '/shop/buy-iphone/iphone-16-pro',
		requiredAny: [['128gb'], ['pro']],
		forbidden: []
	},
	'iphone-16-pro-256': {
		path: '/shop/buy-iphone/iphone-16-pro',
		requiredAny: [['256gb'], ['pro']],
		forbidden: []
	},
	'ipad-air-11-m2-256-wifi': {
		path: '/shop/buy-ipad/ipad-air',
		requiredAny: [['11', '11-inch', '11inch'], ['256gb'], ['wi-fi', 'wifi']],
		forbidden: []
	},
	'ipad-pro-11-m4-256-wifi': {
		path: '/shop/buy-ipad/ipad-pro',
		requiredAny: [['11', '11-inch', '11inch'], ['256gb'], ['wi-fi', 'wifi'], ['pro']],
		forbidden: []
	},
	'watch-series-10-46-gps': {
		path: '/shop/buy-watch/apple-watch-series-10',
		requiredAny: [['46mm'], ['gps'], ['series 10']],
		forbidden: []
	},
	'watch-ultra-2-49': {
		path: '/shop/buy-watch/apple-watch-ultra-2',
		requiredAny: [['49mm'], ['ultra 2']],
		forbidden: []
	}
};

async function fetchText(url) {
	const response = await fetch(url, {
		headers: {
			'user-agent': USER_AGENT,
			'accept-language': 'en-US,en;q=0.8'
		}
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.text();
}

function normalizeCode(locale) {
	if (locale.toLowerCase() === 'uk') return 'GB';
	return locale.toUpperCase().replace(/-/g, '_');
}

function decodeHtmlEntities(s) {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&nbsp;/g, ' ')
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

function extractLocales(html) {
	const locales = [];
	const regex = /<li[^>]*typeof="schema:Country"[\s\S]*?<a[^>]*href="\/([a-z]{2}(?:-[a-z]{2})?)\/"[^>]*>[\s\S]*?<span[^>]*property="schema:name"[^>]*>([\s\S]*?)<\/span>/gim;
	for (const match of html.matchAll(regex)) {
		const locale = match[1].toLowerCase();
		const name = decodeHtmlEntities(match[2].replace(/<[^>]*>/g, '').trim());
		locales.push({ locale, name });
	}

	const byLocale = new Map();
	for (const item of locales) {
		if (!byLocale.has(item.locale)) byLocale.set(item.locale, item);
	}
	return [...byLocale.values()].sort((a, b) => a.locale.localeCompare(b.locale));
}

function extractCurrencyCode(shopHtml) {
	const metricsMatch = shopHtml.match(/<script type="application\/json" id="metrics">([\s\S]*?)<\/script>/i);
	if (!metricsMatch) return null;
	try {
		const parsed = JSON.parse(metricsMatch[1]);
		return parsed?.data?.properties?.currencyCode ?? parsed?.data?.currency ?? null;
	} catch {
		return null;
	}
}

function hasRequiredTokens(windowText, requiredAnyGroups) {
	return requiredAnyGroups.every((group) => group.some((token) => windowText.includes(token)));
}

function extractPricesWithContext(html) {
	const values = [];
	const pattern = /"(?:fullPrice|amount)"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/g;
	for (const match of html.matchAll(pattern)) {
		const index = match.index ?? 0;
		const value = Number(match[1]);
		if (!Number.isFinite(value) || value <= 0) continue;
		const context = html.slice(Math.max(0, index - 700), Math.min(html.length, index + 700)).toLowerCase();
		values.push({ value, context });
	}
	return values;
}

function pickPrice(html, spec) {
	const candidates = extractPricesWithContext(html);
	const filtered = candidates
		.filter(({ context }) => {
			if (!hasRequiredTokens(context, spec.requiredAny)) return false;
			return !spec.forbidden.some((token) => context.includes(token));
		})
		.map((x) => x.value);

	if (filtered.length > 0) return Math.round(Math.min(...filtered));

	const fallback = candidates.map((x) => x.value).filter((value) => value >= 50);
	if (fallback.length === 0) return null;
	return Math.round(Math.min(...fallback));
}

async function mapLimit(items, limit, mapper) {
	const out = [];
	let idx = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (true) {
			const current = idx++;
			if (current >= items.length) break;
			out[current] = await mapper(items[current], current);
		}
	});
	await Promise.all(workers);
	return out;
}

function collectVariants(families) {
	const variants = [];
	for (const family of families) {
		for (const line of family.lines) {
			for (const variant of line.variants) {
				variants.push(variant);
			}
		}
	}
	return variants;
}

function fmt(n) {
	return new Intl.NumberFormat('en-US').format(n);
}

async function main() {
	await mkdir(dataDir, { recursive: true });

	const chooseRegionHtml = await fetchText('https://www.apple.com/choose-country-region/');
	const localeRecords = extractLocales(chooseRegionHtml);

	const jurisdictionsRaw = await mapLimit(localeRecords, 8, async ({ locale, name }) => {
		try {
			const shopHtml = await fetchText(`https://www.apple.com/${locale}/shop`);
			const currency = extractCurrencyCode(shopHtml);
			if (!currency) {
				return { locale, name, code: normalizeCode(locale), currency: null, status: 'missing-currency' };
			}
			return { locale, name, code: normalizeCode(locale), currency, status: 'ok' };
		} catch (error) {
			return {
				locale,
				name,
				code: normalizeCode(locale),
				currency: null,
				status: 'shop-fetch-failed',
				error: String(error)
			};
		}
	});

	const jurisdictions = jurisdictionsRaw
		.filter((j) => j.currency)
		.map(({ locale, name, code, currency }) => ({ locale, code, name, currency }))
		.sort((a, b) => a.locale.localeCompare(b.locale));

	await writeFile(jurisdictionsPath, `${JSON.stringify(jurisdictions, null, 2)}\n`, 'utf8');

	const prices = JSON.parse(await readFile(pricesPath, 'utf8'));
	prices.countries = jurisdictions.map((j) => ({ code: j.code, name: j.name, currency: j.currency }));

	const variants = collectVariants(prices.families);
	const pageCache = new Map();
	const stats = {
		totalJurisdictionsDiscovered: localeRecords.length,
		jurisdictionsWithCurrency: jurisdictions.length,
		jurisdictionsMissingCurrency: jurisdictionsRaw.length - jurisdictions.length,
		existingPricesKept: 0,
		missingSlots: 0,
		attemptedFetches: 0,
		filledNewPrices: 0,
		failedFetches: 0
	};
	const failures = [];

	for (const jurisdiction of jurisdictions) {
		for (const variant of variants) {
			if (typeof variant.prices[jurisdiction.code] === 'number') {
				stats.existingPricesKept += 1;
				continue;
			}
			stats.missingSlots += 1;

			const spec = VARIANT_SPECS[variant.id];
			if (!spec) {
				stats.failedFetches += 1;
				failures.push(`${jurisdiction.locale} ${variant.id}: missing spec`);
				continue;
			}

			stats.attemptedFetches += 1;
			const cacheKey = `${jurisdiction.locale}:${spec.path}`;
			let html = pageCache.get(cacheKey);
			if (!html) {
				try {
					html = await fetchText(`https://www.apple.com/${jurisdiction.locale}${spec.path}`);
					pageCache.set(cacheKey, html);
				} catch (error) {
					stats.failedFetches += 1;
					failures.push(`${jurisdiction.locale} ${variant.id}: fetch failed (${String(error)})`);
					continue;
				}
			}

			const price = pickPrice(html, spec);
			if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
				variant.prices[jurisdiction.code] = price;
				stats.filledNewPrices += 1;
			} else {
				stats.failedFetches += 1;
				failures.push(`${jurisdiction.locale} ${variant.id}: no matching price`);
			}
		}
	}

	await writeFile(pricesPath, `${JSON.stringify(prices, null, 2)}\n`, 'utf8');

	const totalSlots = variants.length * jurisdictions.length;
	const coveragePercent = totalSlots > 0 ? (((stats.existingPricesKept + stats.filledNewPrices) / totalSlots) * 100).toFixed(2) : '0.00';
	const report = `# Apple Ingestion Report\n\nGenerated: ${new Date().toISOString()}\n\n## Jurisdictions\n- Discovered from choose-country-region: ${fmt(stats.totalJurisdictionsDiscovered)}\n- With currency parsed from /shop metrics JSON: ${fmt(stats.jurisdictionsWithCurrency)}\n- Missing currency / failed: ${fmt(stats.jurisdictionsMissingCurrency)}\n\n## Prices\n- Variants modeled: ${fmt(variants.length)}\n- Total variant-country slots: ${fmt(totalSlots)}\n- Existing prices preserved: ${fmt(stats.existingPricesKept)}\n- Missing slots discovered: ${fmt(stats.missingSlots)}\n- Fetch attempts: ${fmt(stats.attemptedFetches)}\n- Newly filled prices: ${fmt(stats.filledNewPrices)}\n- Failed fills: ${fmt(stats.failedFetches)}\n- Final coverage: ${coveragePercent}%\n\n## Notes\n- The ingestor uses pragmatic HTML/JSON token matching against Apple buy pages per variant.\n- Existing prices are never overwritten.\n\n## Sample failures (first 50)\n${failures.slice(0, 50).map((x) => `- ${x}`).join('\n') || '- None'}\n`;

	await writeFile(reportPath, report, 'utf8');

	console.log(
		JSON.stringify(
			{
				jurisdictions: stats.jurisdictionsWithCurrency,
				variants: variants.length,
				totalSlots,
				newlyFilled: stats.filledNewPrices,
				coveragePercent
			},
			null,
			2
		)
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
