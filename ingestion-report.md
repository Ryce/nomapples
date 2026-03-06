# Apple Ingestion Report

Generated: 2026-03-06T03:46:24.660Z

## Baseline
- Previous known coverage: 65.41%

## Jurisdictions
- Discovered from choose-country-region (Scrapling parse): 97
- With currency parsed from /shop (Scrapling parse): 40
- Missing currency / failed: 57

## Prices
- Variants modeled: 10
- Total variant-country slots: 400
- Existing prices preserved: 306
- Missing slots discovered: 94
- Fetch attempts: 94
- Newly filled prices: 0
- Failed fills: 94
- Final coverage: 76.50%

## Tooling evidence
- Scrapling parser calls (locales/currency/prices): 285
- PinchTab server started in this run: already running
- PinchTab fallback attempts (nav + eval(document.documentElement.outerHTML)): 94
- PinchTab fallback successful price extractions: 0

## Method
- Switched Apple watch paths to live endpoints (/shop/buy-watch/apple-watch and /shop/buy-watch/apple-watch-ultra).
- Used static HTML first, then PinchTab-rendered HTML fallback for hard locales/pages.
- Parsed locales, currencies, and price candidates through Python Scrapling helper.
- Existing prices are never overwritten.

## Sample failures (first 50)
- ae iphone-16-pro-128: no matching price
- ae iphone-16-pro-256: no matching price
- ae-ar macbook-air-13-m3-16-512: no matching price
- ae-ar macbook-pro-14-m4pro-18-512: no matching price
- ae-ar mac-mini-m4-16-512: no matching price
- ae-ar iphone-16-128: no matching price
- ae-ar iphone-16-pro-128: no matching price
- ae-ar iphone-16-pro-256: no matching price
- ae-ar ipad-air-11-m2-256-wifi: no matching price
- ae-ar ipad-pro-11-m4-256-wifi: no matching price
- ae-ar watch-series-10-46-gps: no matching price
- ae-ar watch-ultra-2-49: no matching price
- at iphone-16-pro-128: no matching price
- at iphone-16-pro-256: no matching price
- au iphone-16-pro-128: no matching price
- au iphone-16-pro-256: no matching price
- br iphone-16-pro-128: no matching price
- br iphone-16-pro-256: no matching price
- cl iphone-16-pro-128: no matching price
- cl iphone-16-pro-256: no matching price
- cz iphone-16-pro-128: no matching price
- cz iphone-16-pro-256: no matching price
- dk iphone-16-pro-128: no matching price
- dk iphone-16-pro-256: no matching price
- es iphone-16-pro-128: no matching price
- es iphone-16-pro-256: no matching price
- fi iphone-16-pro-128: no matching price
- fi iphone-16-pro-256: no matching price
- fr iphone-16-pro-128: no matching price
- fr iphone-16-pro-256: no matching price
- hk iphone-16-pro-128: no matching price
- hk iphone-16-pro-256: no matching price
- hu iphone-16-pro-128: no matching price
- hu iphone-16-pro-256: no matching price
- ie iphone-16-pro-128: no matching price
- ie iphone-16-pro-256: no matching price
- in iphone-16-pro-128: no matching price
- in iphone-16-pro-256: no matching price
- it iphone-16-pro-128: no matching price
- it iphone-16-pro-256: no matching price
- kr iphone-16-pro-128: no matching price
- kr iphone-16-pro-256: no matching price
- la macbook-air-13-m3-16-512: no matching price
- la macbook-pro-14-m4pro-18-512: no matching price
- la mac-mini-m4-16-512: no matching price
- la iphone-16-128: no matching price
- la iphone-16-pro-128: no matching price
- la iphone-16-pro-256: no matching price
- la ipad-air-11-m2-256-wifi: no matching price
- la ipad-pro-11-m4-256-wifi: no matching price
