from __future__ import absolute_import

from sentry.lang.javascript.cache import SourceCache
from unittest import TestCase


class BasicCacheTest(TestCase):
    def test_basic_features(self):
        cache = SourceCache()

        url = "http://example.com/foo.js"

        assert url not in cache
        assert cache.get(url) is None

        cache.add(url, b"foo\nbar")
        assert url in cache
        assert cache.get(url) is not None
        assert cache.get(url)[0] == u"foo"

        cache.alias(url + "x", url)
        assert url + "x" in cache
        assert cache.get(url + "x")[0] == u"foo"

    def test_encoding_fallback(self):
        cache = SourceCache()

        url = "http://example.com/foo.js"

        # fall back to utf-8
        cache.add(url, b"foobar", encoding="utf-32")
        assert cache.get(url)[0] == u"foobar"

    def test_encoding_support(self):
        cache = SourceCache()
        url = "http://example.com/foo.js"

        # fall back to utf-8
        cache.add(url, "foobar".encode("utf-32"), encoding="utf-32")
        assert cache.get(url)[0] == u"foobar"
