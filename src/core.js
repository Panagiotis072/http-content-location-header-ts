const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const ABSOLUTE_PATH_RE = /^\//;

/**
 * Removes dot segments from a URL path per RFC 3986 section 5.2.4.
 * We keep this separate from the WHATWG URL parser because Content-Location
 * values are often relative references that must be resolved against a base,
 * and the URL parser would reject or mangle some of them.
 */
function removeDotSegments(path) {
  const input = path;
  let output = '';
  let remaining = input;

  while (remaining.length > 0) {
    if (remaining.startsWith('../')) {
      remaining = remaining.slice(3);
    } else if (remaining.startsWith('./')) {
      remaining = remaining.slice(2);
    } else if (remaining.startsWith('/./')) {
      remaining = '/' + remaining.slice(3);
    } else if (remaining === '/.') {
      remaining = '/';
    } else if (remaining.startsWith('/../')) {
      remaining = '/' + remaining.slice(4);
      output = output.replace(/\/[^/]*$/, '');
    } else if (remaining === '/..') {
      remaining = '/';
      output = output.replace(/\/[^/]*$/, '');
    } else if (remaining === '.' || remaining === '..') {
      remaining = '';
    } else {
      const slash = remaining.indexOf('/', remaining.startsWith('/') ? 1 : 0);
      if (slash === -1) {
        output += remaining;
        remaining = '';
      } else {
        output += remaining.slice(0, slash);
        remaining = remaining.slice(slash);
      }
    }
  }

  return output;
}

/**
 * Splits a URL reference into its five components without relying on the
 * WHATWG URL constructor, which normalizes and rejects inputs we need to
 * handle (for example schemes without an authority).
 */
function splitReference(ref) {
  const match = ref.match(/^(?:([A-Za-z][A-Za-z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
  if (!match) {
    return { scheme: undefined, authority: undefined, path: ref, query: undefined, fragment: undefined };
  }
  return {
    scheme: match[1],
    authority: match[2],
    path: match[3],
    query: match[4],
    fragment: match[5],
  };
}

/**
 * Merges a reference path onto a base path per RFC 3986 section 5.3.
 * If the reference path is absolute we use it directly; otherwise we replace
 * everything after the last slash of the base path.
 */
function mergePaths(base, refPath) {
  if (base.authority !== undefined && base.path === '') {
    return '/' + refPath;
  }
  const lastSlash = base.path.lastIndexOf('/');
  if (lastSlash === -1) {
    return refPath;
  }
  return base.path.slice(0, lastSlash + 1) + refPath;
}

/**
 * Rebuilds a URL string from components. Empty authority is preserved when
 * the scheme is present but the authority is the empty string, because
 * `file:///` style references are meaningful.
 */
function recompose(url) {
  let result = '';
  if (url.scheme !== undefined) {
    result += url.scheme + ':';
  }
  if (url.authority !== undefined) {
    result += '//' + url.authority;
  }
  result += url.path;
  if (url.query !== undefined) {
    result += '?' + url.query;
  }
  if (url.fragment !== undefined) {
    result += '#' + url.fragment;
  }
  return result;
}

/**
 * Resolves a URL reference against a base URL per RFC 3986 section 5.3.
 * We implement this ourselves rather than using `new URL(ref, base)` because
 * the WHATWG URL parser is deliberately lossy for some references (for
 * example it drops empty fragments) and throws on bases that are not
 * absolute. Content-Location values are allowed to be relative references,
 * so we need the stricter RFC behaviour.
 */
export function resolveContentLocation(ref, base) {
  const r = splitReference(ref);
  const b = splitReference(base);

  const target = {};

  if (r.scheme !== undefined) {
    target.scheme = r.scheme;
    target.authority = r.authority;
    target.path = removeDotSegments(r.path);
    target.query = r.query;
  } else {
    if (r.authority !== undefined) {
      target.authority = r.authority;
      target.path = removeDotSegments(r.path);
      target.query = r.query;
    } else {
      if (r.path === '') {
        target.path = b.path;
        if (r.query !== undefined) {
          target.query = r.query;
        } else {
          target.query = b.query;
        }
      } else {
        if (r.path.startsWith('/')) {
          target.path = removeDotSegments(r.path);
        } else {
          target.path = removeDotSegments(mergePaths(b, r.path));
        }
        target.query = r.query;
      }
      target.authority = b.authority;
    }
    target.scheme = b.scheme;
  }

  target.fragment = r.fragment;

  return recompose(target);
}

/**
 * Parses a Content-Location header value. Whitespace around the value is
 * stripped; an empty or whitespace-only value yields null, because an empty
 * Content-Location is not a valid URI reference and callers need a way to
 * distinguish "absent" from "present but empty".
 */
export function parseContentLocation(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

/**
 * Normalizes a Content-Location header into an absolute URL resolved against
 * a base URL. If the header is absent or empty this returns null. If the
 * header is already an absolute URL it is returned with dot segments removed.
 * The base must be an absolute URL; a relative base makes resolution
 * impossible and we throw a TypeError so the caller notices the mistake
 * rather than silently producing a wrong URL.
 */
export function normalizeContentLocation(headerValue, baseUrl) {
  if (typeof baseUrl !== 'string' || !SCHEME_RE.test(baseUrl)) {
    throw new TypeError('baseUrl must be an absolute URL');
  }
  const parsed = parseContentLocation(headerValue);
  if (parsed === null) {
    return null;
  }
  return resolveContentLocation(parsed, baseUrl);
}
