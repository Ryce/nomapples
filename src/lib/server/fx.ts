const FX_URL = 'https://api.frankfurter.app/latest?from=USD';
const FALLBACK_RATES: Record<string, number> = {
	USD: 1,
	EUR: 0.92,
	JPY: 150,
	VND: 24600,
	GBP: 0.78,
	CAD: 1.35
};

export type FxResult = {
	rates: Record<string, number>;
	updatedAt: string;
	source: 'live' | 'fallback';
};

export async function getUsdRates(fetchFn: typeof fetch): Promise<FxResult> {
	try {
		const res = await fetchFn(FX_URL, {
			headers: { accept: 'application/json' }
		});

		if (!res.ok) throw new Error(`FX API status ${res.status}`);

		const payload = (await res.json()) as {
			date?: string;
			rates?: Record<string, number>;
		};

		const rates = {
			USD: 1,
			...(payload.rates ?? {})
		};

		return {
			rates,
			updatedAt: payload.date ?? new Date().toISOString().slice(0, 10),
			source: 'live'
		};
	} catch {
		return {
			rates: FALLBACK_RATES,
			updatedAt: new Date().toISOString().slice(0, 10),
			source: 'fallback'
		};
	}
}

export function toUsd(localPrice: number, currency: string, usdRates: Record<string, number>): number {
	const rate = usdRates[currency];
	if (!rate || rate <= 0) throw new Error(`Missing or invalid FX rate for ${currency}`);
	return localPrice / rate;
}
