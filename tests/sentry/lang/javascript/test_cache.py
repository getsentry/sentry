from unittest import TestCase

from sentry.lang.javascript.cache import SourceCache


class BasicCacheTest(TestCase):
    def test_basic_features(self) -> None:
        cache = SourceCache()
        url = "http://example.com/foo.js"

        assert url not in cache
        assert cache.get(url) is None

        cache.add(url, b"foo\nbar")
        assert url in cache
        view = cache.get(url)
        assert view is not None
        assert view[0] == "foo"

        cache.alias(url + "x", url)
        assert url + "x" in cache
        view = cache.get(url + "x")
        assert view is not None
        assert view[0] == "foo"

    def test_encoding_fallback(self) -> None:
        cache = SourceCache()
        url = "http://example.com/foo.js"

        # fall back to utf-8
        cache.add(url, b"foobar", encoding="utf-32")
        view = cache.get(url)
        assert view is not None
        assert view[0] == "foobar"

    def test_encoding_support(self) -> None:
        cache = SourceCache()
        url = "http://example.com/foo.js"

        # fall back to utf-8
        cache.add(url, "foobar".encode("utf-32"), encoding="utf-32")
        view = cache.get(url)
        assert view is not None
        assert view[0] == "foobar"
