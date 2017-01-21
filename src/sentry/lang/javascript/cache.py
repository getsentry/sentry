from __future__ import absolute_import, print_function

__all__ = ['SourceCache', 'SourceMapCache']


class SourceCache(object):
    def __init__(self):
        self._cache = {}
        self._errors = {}
        self._aliases = {}

    def __contains__(self, url):
        url = self._get_canonical_url(url)
        return url in self._cache

    def _get_canonical_url(self, url):
        if url in self._aliases:
            url = self._aliases[url]
        return url

    def get(self, url):
        url = self._get_canonical_url(url)
        try:
            parsed, rv = self._cache[url]
        except KeyError:
            return None

        # We have already gotten this file and we've
        # decoded the response, so just return
        if parsed:
            return rv

        # Otherwise, we have a 2-tuple that needs to be applied
        body, encoding = rv

        # Our body is lazily evaluated if it
        # comes from libsourcemap
        if callable(body):
            body = body()

        try:
            body = body.decode(encoding or 'utf8', 'replace').split(u'\n')
        except LookupError:
            # We got an encoding that python doesn't support,
            # so let's just coerce it to utf8
            body = body.decode('utf8', 'replace').split(u'\n')

        # Set back a marker to indicate we've parsed this url
        self._cache[url] = (True, body)
        return body

    def get_errors(self, url):
        url = self._get_canonical_url(url)
        return self._errors.get(url, [])

    def alias(self, u1, u2):
        if u1 == u2:
            return

        if u1 in self._cache or u1 not in self._aliases:
            self._aliases[u1] = u1
        else:
            self._aliases[u2] = u1

    def add(self, url, source, encoding=None):
        url = self._get_canonical_url(url)
        # Insert into the cache, an unparsed (source, encoding)
        # tuple. This allows the source to be split and decoded
        # on demand when first accessed.
        self._cache[url] = (False, (source, encoding))

    def add_error(self, url, error):
        url = self._get_canonical_url(url)
        self._errors.setdefault(url, [])
        self._errors[url].append(error)


class SourceMapCache(object):
    def __init__(self):
        self._cache = {}
        self._mapping = {}

    def __contains__(self, sourcemap_url):
        return sourcemap_url in self._cache

    def link(self, url, sourcemap_url):
        self._mapping[url] = sourcemap_url

    def add(self, sourcemap_url, sourcemap_view):
        self._cache[sourcemap_url] = sourcemap_view

    def get(self, sourcemap_url):
        return self._cache.get(sourcemap_url)

    def get_link(self, url):
        sourcemap_url = self._mapping.get(url)
        if sourcemap_url:
            sourcemap = self.get(sourcemap_url)
            return (sourcemap_url, sourcemap)
        return (None, None)
