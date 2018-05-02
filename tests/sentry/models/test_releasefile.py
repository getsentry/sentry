from __future__ import absolute_import

from sentry.models import ReleaseFile
from sentry.testutils import TestCase


class ReleaseFileTestCase(TestCase):
    def test_normalize(self):
        n = ReleaseFile.normalize

        assert n('http://example.com') == [
            'http://example.com',
            '~',
        ]
        assert n('http://example.com/foo.js') == [
            'http://example.com/foo.js',
            '~/foo.js',
        ]
        assert n('http://example.com/foo.js?bar') == [
            'http://example.com/foo.js?bar',
            'http://example.com/foo.js',
            '~/foo.js?bar',
            '~/foo.js',
        ]
        assert n('/foo.js') == [
            '/foo.js',
            '~/foo.js',
        ]

        # This is the current behavior, but seems weird to me.
        # unclear if we actually experience this case in the real
        # world, but worth documenting the behavior
        assert n('foo.js') == [
            'foo.js',
            '~foo.js',
        ]
