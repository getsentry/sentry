from unittest import TestCase

from sentry.lang.javascript.cache import SourceCache


class BasicCacheTest(TestCase):
    def test_basic_features(self):
        cache = SourceCache()
        url = "http://example.com/foo.js"

        assert url not in cache
        assert cache.get(url) is None

        cache.add(url, b"foo\nbar")
        assert url in cache
        assert cache.get(url) == "foo\nbar"

        cache.alias(url + "x", url)
        assert url + "x" in cache
        assert cache.get(url + "x") == "foo\nbar"

    def test_encoding_fallback(self):
        cache = SourceCache()
        url = "http://example.com/foo.js"

        # fall back to utf-8
        cache.add(url, b"foobar", encoding="utf-32")
        assert cache.get(url) == "foobar"

    def test_encoding_support(self):
        cache = SourceCache()
        url = "http://example.com/foo.js"

        # fall back to utf-8
        cache.add(url, "foobar".encode("utf-32"), encoding="utf-32")
        assert cache.get(url) == "foobar"
