# http-content-location-header-ts

Parses and normalizes the HTTP `Content-Location` header into an absolute URL resolved against a base URL.

```js
import { normalizeContentLocation } from './src/index.js';

const absolute = normalizeContentLocation('  images/logo.png  ', 'https://example.test/docs/page.html');
// 'https://example.test/docs/images/logo.png'

const missing = normalizeContentLocation('', 'https://example.test/docs/page.html');
// null
```

## Why this exists

The `Content-Location` header carries a URI reference, not necessarily an absolute URL. Servers commonly send relative references such as `images/logo.png` or `/docs/index.html`, and a client that wants to compare or cache by absolute URL has to resolve them against the request URI. The WHATWG `URL` constructor does this, but it is deliberately lossy for some references and throws on bases that are not absolute; RFC 3986 resolution is stricter about preserving empty query and fragment components.

This library implements the RFC 3986 reference resolution algorithm directly. The trade-off is that it is not a full WHATWG URL parser: it does not percent-encode, decode, or normalize host case. It resolves references and removes dot segments, which is what a `Content-Location` consumer needs, and it leaves everything else alone.

## API

- `parseContentLocation(value)` — trims surrounding whitespace and returns the header value, or `null` if the value is absent, empty, whitespace-only, or not a string.
- `resolveContentLocation(ref, base)` — resolves a URI reference against an absolute base URL per RFC 3986, returning the resulting URL string.
- `normalizeContentLocation(headerValue, baseUrl)` — parses the header and resolves it against `baseUrl`. Returns `null` for an absent or empty header, and throws a `TypeError` if `baseUrl` is not an absolute URL.

## The awkward edge

An empty or whitespace-only `Content-Location` is not a valid URI reference, so `parseContentLocation` and `normalizeContentLocation` return `null` rather than an empty string. Callers that treat `null` as "header absent" and `''` as "header present but empty" will need to collapse those two cases themselves; this library does not distinguish them.
