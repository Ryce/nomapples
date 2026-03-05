# nomapples

Where nomads buy Apple products smarter.

Compare Apple product prices across countries with live FX conversion (Frankfurter API) and normalized USD ranking.

## Stack

- SvelteKit (latest)
- Cloudflare Workers via `@sveltejs/adapter-cloudflare`
- JSON product pricing (`src/lib/data/prices.json`)
- Live FX rates with fallback + edge caching

## Local dev

```bash
npm install
npm run dev
```

## Deploy to Cloudflare

1. Authenticate once:

```bash
npx wrangler login
```

2. Deploy:

```bash
npm run deploy
```

## Data model (v1)

Edit `src/lib/data/prices.json`:

- `countries[]`: country code, name, and local currency
- `products[]`: product id/name + local prices by country code

No DB required right now. To migrate later:

- replace JSON reads with D1/KV fetch in `+page.server.ts`
- keep UI unchanged

## FX behavior

- Source: `https://api.frankfurter.app/latest?from=USD`
- Uses Cloudflare Cache API with a 6-hour TTL
- Falls back to baked-in rates if API is unavailable

## Notes

- Prices are sample starter values, replace with your own source of truth.
- Normalization is to USD so countries can be ranked directly.
