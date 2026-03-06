#!/usr/bin/env python3
import json
import re
import sys
from html import unescape
from scrapling import Adaptor


def normalize_num(raw):
    if raw is None:
        return None
    s = str(raw).strip().replace(',', '')
    if not s:
        return None
    try:
        value = float(s)
    except Exception:
        return None
    if value <= 0:
        return None
    return int(round(value))


def parse_locales(html):
    doc = Adaptor(html)
    out = []
    seen = set()
    for li in doc.css('li[typeof="schema:Country"]'):
        a = li.css_first('a[href]')
        span = li.css_first('span[property="schema:name"]')
        if not a or not span:
            continue
        href = a.attrib.get('href', '')
        m = re.search(r'/([a-z]{2}(?:-[a-z]{2})?)/', href, re.I)
        if not m:
            continue
        locale = m.group(1).lower()
        if locale in seen:
            continue
        seen.add(locale)
        name = unescape((span.text or '').strip())
        out.append({'locale': locale, 'name': name})
    out.sort(key=lambda x: x['locale'])
    return out


def parse_currency(html):
    doc = Adaptor(html)
    metrics = doc.css_first('script#metrics')
    if metrics:
        try:
            parsed = json.loads(metrics.text)
            currency = (
                parsed.get('data', {}).get('properties', {}).get('currencyCode')
                or parsed.get('data', {}).get('currency')
            )
            if currency:
                return {'currency': currency}
        except Exception:
            pass

    scripts = doc.css('script[type="application/ld+json"],script[type="application/json"],script:not([type])')
    pattern = re.compile(r'"currency(?:Code)?"\s*:\s*"([A-Z]{3})"')
    for script in scripts:
        txt = script.text or ''
        m = pattern.search(txt)
        if m:
            return {'currency': m.group(1)}
    return {'currency': None}


def parse_price(html, spec):
    req_groups = [[x.lower() for x in grp] for grp in spec.get('requiredAny', [])]
    forbidden = [x.lower() for x in spec.get('forbidden', [])]

    # pull candidate prices from common Apple JSON fields
    pattern = re.compile(
        r'"(?:fullPrice|currentPrice|amount|raw_amount|price|displayPrice|startingPrice|priceAmount)"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?',
        re.I,
    )

    candidates = []
    html_low = html.lower()
    for m in pattern.finditer(html):
        num = normalize_num(m.group(1))
        if not num:
            continue
        idx = m.start()
        ctx = html_low[max(0, idx - 1200): min(len(html_low), idx + 1200)]
        candidates.append((num, ctx))

    def match_ctx(ctx):
        for grp in req_groups:
            if not any(tok in ctx for tok in grp):
                return False
        if any(tok in ctx for tok in forbidden):
            return False
        return True

    strong = [n for n, ctx in candidates if match_ctx(ctx)]
    if strong:
        return {'price': int(min(strong)), 'candidateCount': len(candidates), 'matched': len(strong)}

    fallback = [n for n, _ in candidates if n >= 50]
    if fallback:
        return {'price': int(min(fallback)), 'candidateCount': len(candidates), 'matched': 0}

    return {'price': None, 'candidateCount': len(candidates), 'matched': 0}


def main():
    if len(sys.argv) < 2:
        print('usage: scrapling_apple.py <locales|currency|price>', file=sys.stderr)
        sys.exit(2)

    mode = sys.argv[1]
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}

    if mode == 'locales':
        print(json.dumps({'locales': parse_locales(payload.get('html', ''))}))
        return
    if mode == 'currency':
        print(json.dumps(parse_currency(payload.get('html', ''))))
        return
    if mode == 'price':
        print(json.dumps(parse_price(payload.get('html', ''), payload.get('spec', {}))))
        return

    print(f'unknown mode: {mode}', file=sys.stderr)
    sys.exit(2)


if __name__ == '__main__':
    main()
