export type Country = {
	code: string;
	name: string;
	currency: string;
};

export type ProductVariant = {
	id: string;
	name: string;
	prices: Record<string, number>;
};

export type ProductLine = {
	id: string;
	name: string;
	variants: ProductVariant[];
};

export type ProductFamily = {
	id: string;
	name: string;
	lines: ProductLine[];
};

export type PricingData = {
	countries: Country[];
	families: ProductFamily[];
};

export type ProductComparison = {
	countryCode: string;
	countryName: string;
	currency: string;
	localPrice: number;
	priceUSD: number;
	deltaFromCheapestUSD: number;
	deltaPercentFromCheapest: number;
};
