# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import zlib

from sentry.cache.redis import RedisCache
from sentry.testutils import TestCase
from sentry.utils.imports import import_string


class FakeCluster(object):
    def get_routing_client(self):
        return ROUTING_CLIENT


class FakeClient(object):
    def get(self, key):
        if key == 'c:1:foo:a':
            return '[{"name":"foo.txt","content_type":"text/plain"}]'
        elif key == 'c:1:foo:a:0':
            return zlib.compress(b'Hello World!')


ROUTING_CLIENT = FakeClient()
CLUSTER = FakeCluster()


class RedisAttachmentTest(TestCase):

    @mock.patch('sentry.utils.redis.redis_clusters.get', return_value=CLUSTER)
    def test_process_pending_one_batch(self, cluster_get):
        attachment_cache = import_string('sentry.attachments.redis.RedisAttachmentCache')()
        cluster_get.assert_any_call('rc-short')
        assert isinstance(attachment_cache.inner, RedisCache)
        assert attachment_cache.inner.client is ROUTING_CLIENT
        assert attachment_cache.inner.cluster is CLUSTER

        rv = attachment_cache.get('foo')
        assert len(rv) == 1
        attachment = rv[0]
        assert attachment.meta() == {
            'type': 'event.attachment',
            'name': 'foo.txt',
            'content_type': 'text/plain'
        }
        assert attachment.data == b'Hello World!'
