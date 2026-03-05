export type Country = {
	code: string;
	name: string;
	currency: string;
};

export type Product = {
	id: string;
	name: string;
	prices: Record<string, number>;
};

export type PricingData = {
	countries: Country[];
	products: Product[];
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
