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
        return self._cache.get(url)

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

    def add(self, url, source):
        url = self._get_canonical_url(url)
        self._cache[url] = source

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

    def add(self, sourcemap_url, sourcemap_index):
        self._cache[sourcemap_url] = sourcemap_index

    def get(self, sourcemap_url):
        return self._cache.get(sourcemap_url)

    def get_link(self, url):
        sourcemap_url = self._mapping.get(url)
        if sourcemap_url:
            sourcemap = self.get(sourcemap_url)
            return (sourcemap_url, sourcemap)
        return (None, None)
