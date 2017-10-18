from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.lang.javascript.cache import SourceCache


class BasicCacheTest(TestCase):
    def test_basic_features(self):
        cache = SourceCache()

        url = 'http://example.com/foo.js'

        assert url not in cache
        assert cache.get(url) is None

        cache.add(url, b'foo\nbar')
        assert url in cache
        assert cache.get(url) is not None
        assert cache.get(url)[0] == u'foo'

        cache.alias(url + 'x', url)
        assert url + 'x' in cache
        assert cache.get(url + 'x')[0] == u'foo'
