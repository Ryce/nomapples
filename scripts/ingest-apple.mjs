#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync, spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'src', 'lib', 'data');
const jurisdictionsPath = path.join(dataDir, 'jurisdictions.json');
const pricesPath = path.join(dataDir, 'prices.json');
const reportPath = path.join(rootDir, 'ingestion-report.md');
const parserPath = path.join(__dirname, 'scrapling_apple.py');

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
		path: '/shop/buy-watch/apple-watch',
		requiredAny: [['46mm'], ['gps'], ['series 10']],
		forbidden: []
	},
	'watch-ultra-2-49': {
		path: '/shop/buy-watch/apple-watch-ultra',
		requiredAny: [['49mm'], ['ultra 2']],
		forbidden: []
	}
};

function normalizeCode(locale) {
	if (locale.toLowerCase() === 'uk') return 'GB';
	return locale.toUpperCase().replace(/-/g, '_');
}

async function fetchText(url, retries = 2) {
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			const out = execFileSync(
				'curl',
				[
					'--silent',
					'--show-error',
					'--location',
					'--max-time',
					'35',
					'--header',
					`user-agent: ${USER_AGENT}`,
					'--header',
					'accept-language: en-US,en;q=0.8',
					url
				],
				{ encoding: 'utf8', maxBuffer: 1024 * 1024 * 30 }
			);
			if (!out || out.length < 100) throw new Error('empty response');
			return out;
		} catch (error) {
			if (attempt === retries) throw error;
			await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
		}
	}
	throw new Error('unreachable');
}

function runParser(mode, payload) {
	if (!existsSync(parserPath)) throw new Error(`missing parser: ${parserPath}`);
	const output = execFileSync('python3', [parserPath, mode], {
		input: JSON.stringify(payload),
		encoding: 'utf8',
		maxBuffer: 1024 * 1024 * 20,
		timeout: 45000,
		env: { ...process.env, PYTHONWARNINGS: 'ignore' }
	});
	return JSON.parse(output);
}

function pinchtab(args) {
	const out = execFileSync('pinchtab', args, {
		encoding: 'utf8',
		maxBuffer: 1024 * 1024 * 20,
		timeout: 30000,
		stdio: ['pipe', 'pipe', 'pipe']
	}).trim();
	try {
		return JSON.parse(out);
	} catch {
		return out;
	}
}

async function ensurePinchtabServer(stats) {
	try {
		pinchtab(['health']);
		stats.pinchtabServerStarted = false;
		return;
	} catch {
		// start it detached
	}

	const child = spawn('pinchtab', [], {
		detached: true,
		stdio: 'ignore'
	});
	child.unref();

	const startedAt = Date.now();
	while (Date.now() - startedAt < 15000) {
		await new Promise((r) => setTimeout(r, 500));
		try {
			pinchtab(['health']);
			stats.pinchtabServerStarted = true;
			return;
		} catch {
			// wait
		}
	}
	throw new Error('pinchtab server did not become healthy within 15s');
}

function pinchtabNavigateAndGetHtml(url) {
	pinchtab(['nav', url]);
	const evaluated = pinchtab(['eval', 'document.documentElement.outerHTML']);
	const html = typeof evaluated === 'object' ? evaluated?.result : evaluated;
	if (!html || typeof html !== 'string' || html.length < 500) {
		throw new Error('pinchtab returned empty html');
	}
	return html;
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
	const localeRecords = runParser('locales', { html: chooseRegionHtml }).locales;

	const stats = {
		totalJurisdictionsDiscovered: localeRecords.length,
		jurisdictionsWithCurrency: 0,
		jurisdictionsMissingCurrency: 0,
		existingPricesKept: 0,
		missingSlots: 0,
		attemptedFetches: 0,
		filledNewPrices: 0,
		failedFetches: 0,
		pinchtabServerStarted: false,
		pinchtabFallbackAttempts: 0,
		pinchtabFallbackSuccess: 0,
		scraplingParses: 0
	};

	const jurisdictionsRaw = [];
	for (const { locale, name } of localeRecords) {
		try {
			const shopHtml = await fetchText(`https://www.apple.com/${locale}/shop`);
			stats.scraplingParses += 1;
			const currency = runParser('currency', { html: shopHtml }).currency;
			if (!currency) {
				jurisdictionsRaw.push({ locale, name, code: normalizeCode(locale), currency: null, status: 'missing-currency' });
				continue;
			}
			jurisdictionsRaw.push({ locale, name, code: normalizeCode(locale), currency, status: 'ok' });
		} catch (error) {
			jurisdictionsRaw.push({ locale, name, code: normalizeCode(locale), currency: null, status: 'shop-fetch-failed', error: String(error) });
		}
	}

	const jurisdictions = jurisdictionsRaw
		.filter((j) => j.currency)
		.map(({ locale, name, code, currency }) => ({ locale, code, name, currency }))
		.sort((a, b) => a.locale.localeCompare(b.locale));

	stats.jurisdictionsWithCurrency = jurisdictions.length;
	stats.jurisdictionsMissingCurrency = jurisdictionsRaw.length - jurisdictions.length;

	await writeFile(jurisdictionsPath, `${JSON.stringify(jurisdictions, null, 2)}\n`, 'utf8');

	const prices = JSON.parse(await readFile(pricesPath, 'utf8'));
	prices.countries = jurisdictions.map((j) => ({ code: j.code, name: j.name, currency: j.currency }));
	const variants = collectVariants(prices.families);
	const pageCache = new Map();
	const failures = [];

	await ensurePinchtabServer(stats);

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
				} catch {
					html = null;
				}
			}

			let price = null;
			if (html) {
				stats.scraplingParses += 1;
				price = runParser('price', { html, spec }).price;
			}

			if (!price) {
				stats.pinchtabFallbackAttempts += 1;
				try {
					const renderedHtml = pinchtabNavigateAndGetHtml(`https://www.apple.com/${jurisdiction.locale}${spec.path}`);
					stats.scraplingParses += 1;
					price = runParser('price', { html: renderedHtml, spec }).price;
					if (price) stats.pinchtabFallbackSuccess += 1;
				} catch (error) {
					failures.push(`${jurisdiction.locale} ${variant.id}: pinchtab fallback failed (${String(error)})`);
				}
			}

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

	const report = `# Apple Ingestion Report\n\nGenerated: ${new Date().toISOString()}\n\n## Baseline\n- Previous known coverage: 65.41%\n\n## Jurisdictions\n- Discovered from choose-country-region (Scrapling parse): ${fmt(stats.totalJurisdictionsDiscovered)}\n- With currency parsed from /shop (Scrapling parse): ${fmt(stats.jurisdictionsWithCurrency)}\n- Missing currency / failed: ${fmt(stats.jurisdictionsMissingCurrency)}\n\n## Prices\n- Variants modeled: ${fmt(variants.length)}\n- Total variant-country slots: ${fmt(totalSlots)}\n- Existing prices preserved: ${fmt(stats.existingPricesKept)}\n- Missing slots discovered: ${fmt(stats.missingSlots)}\n- Fetch attempts: ${fmt(stats.attemptedFetches)}\n- Newly filled prices: ${fmt(stats.filledNewPrices)}\n- Failed fills: ${fmt(stats.failedFetches)}\n- Final coverage: ${coveragePercent}%\n\n## Tooling evidence\n- Scrapling parser calls (locales/currency/prices): ${fmt(stats.scraplingParses)}\n- PinchTab server started in this run: ${stats.pinchtabServerStarted ? 'yes' : 'already running'}\n- PinchTab fallback attempts (nav + eval(document.documentElement.outerHTML)): ${fmt(stats.pinchtabFallbackAttempts)}\n- PinchTab fallback successful price extractions: ${fmt(stats.pinchtabFallbackSuccess)}\n\n## Method\n- Switched Apple watch paths to live endpoints (/shop/buy-watch/apple-watch and /shop/buy-watch/apple-watch-ultra).\n- Used static HTML first, then PinchTab-rendered HTML fallback for hard locales/pages.\n- Parsed locales, currencies, and price candidates through Python Scrapling helper.\n- Existing prices are never overwritten.\n\n## Sample failures (first 50)\n${failures.slice(0, 50).map((x) => `- ${x}`).join('\n') || '- None'}\n`;

	await writeFile(reportPath, report, 'utf8');

	console.log(
		JSON.stringify(
			{
				jurisdictions: stats.jurisdictionsWithCurrency,
				variants: variants.length,
				totalSlots,
				newlyFilled: stats.filledNewPrices,
				coveragePercent,
				pinchtabFallbackAttempts: stats.pinchtabFallbackAttempts,
				pinchtabFallbackSuccess: stats.pinchtabFallbackSuccess,
				scraplingParses: stats.scraplingParses
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
