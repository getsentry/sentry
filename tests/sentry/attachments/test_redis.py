# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import zlib

from sentry.cache.redis import RedisCache
from sentry.testutils import TestCase
from sentry.utils.imports import import_string


class FakeClient(object):
    def get(self, key):
        if key == 'c:1:foo:a':
            return '[{"name":"foo.txt","content_type":"text/plain"}]'
        elif key == 'c:1:foo:a:0':
            return zlib.compress(b'Hello World!')


CLIENT = FakeClient()


class RedisAttachmentTest(TestCase):

    @mock.patch('sentry.utils.redis.redis_clusters.get', return_value=CLIENT)
    def test_process_pending_one_batch(self, cluster_get):
        attachment_cache = import_string('sentry.attachments.redis.RedisAttachmentCache')()
        cluster_get.assert_any_call('rc-short')
        assert isinstance(attachment_cache.inner, RedisCache)
        assert attachment_cache.inner.client is CLIENT

        rv = attachment_cache.get('foo')
        assert len(rv) == 1
        attachment = rv[0]
        assert attachment.meta() == {
            'type': 'event.attachment',
            'name': 'foo.txt',
            'content_type': 'text/plain'
        }
        assert attachment.data == b'Hello World!'
