# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import six
import time

from exam import fixture, patcher

from sentry.quotas.redis import (
    is_rate_limited,
    BasicRedisQuota,
    RedisQuota,
)
from sentry.testutils import TestCase
from sentry.utils.redis import clusters
from six.moves import xrange


def test_is_rate_limited_script():
    now = int(time.time())

    cluster = clusters.get('default')
    client = cluster.get_local_client(six.next(iter(cluster.hosts)))

    # The item should not be rate limited by either key.
    assert list(map(bool, is_rate_limited(
                client, ('foo', 'r:foo', 'bar', 'r:bar'), (1, now + 60, 2, now + 120)))
                ) == [False, False]

    # The item should be rate limited by the first key (1).
    assert list(map(bool, is_rate_limited(
                client, ('foo', 'r:foo', 'bar', 'r:bar'), (1, now + 60, 2, now + 120)))
                ) == [True, False]

    # The item should still be rate limited by the first key (1), but *not*
    # rate limited by the second key (2) even though this is the third time
    # we've checked the quotas. This ensures items that are rejected by a lower
    # quota don't affect unrelated items that share a parent quota.
    assert list(map(bool, is_rate_limited(
                client, ('foo', 'r:foo', 'bar', 'r:bar'), (1, now + 60, 2, now + 120)))
                ) == [True, False]

    assert client.get('foo') == '1'
    assert 59 <= client.ttl('foo') <= 60

    assert client.get('bar') == '1'
    assert 119 <= client.ttl('bar') <= 120

    # make sure "refund/negative" keys haven't been incremented
    assert client.get('r:foo') is None
    assert client.get('r:bar') is None

    # Test that refunded quotas work
    client.set('apple', 5)
    # increment
    is_rate_limited(
        client, ('orange', 'baz'), (1, now + 60)
    )
    # test that it's rate limited without refund
    assert list(map(bool, is_rate_limited(
        client, ('orange', 'baz'), (1, now + 60)
    ))) == [True, ]
    # test that refund key is used
    assert list(map(bool, is_rate_limited(
        client, ('orange', 'apple'), (1, now + 60)
    ))) == [False, ]


class RedisQuotaTest(TestCase):
    quota = fixture(RedisQuota)

    @patcher.object(RedisQuota, 'get_project_quota')
    def get_project_quota(self):
        inst = mock.MagicMock()
        inst.return_value = (0, 60)
        return inst

    @patcher.object(RedisQuota, 'get_organization_quota')
    def get_organization_quota(self):
        inst = mock.MagicMock()
        inst.return_value = (0, 60)
        return inst

    def test_uses_defined_quotas(self):
        self.get_project_quota.return_value = (200, 60)
        self.get_organization_quota.return_value = (300, 60)
        quotas = self.quota.get_quotas(self.project)
        assert quotas[0].key == 'p:{}'.format(self.project.id)
        assert quotas[0].limit == 200
        assert quotas[0].window == 60
        assert quotas[1].key == 'o:{}'.format(self.project.organization.id)
        assert quotas[1].limit == 300
        assert quotas[1].window == 60

    @mock.patch('sentry.quotas.redis.is_rate_limited')
    @mock.patch.object(RedisQuota, 'get_quotas', return_value=[])
    def test_bails_immediately_without_any_quota(self, get_quotas, is_rate_limited):
        result = self.quota.is_rate_limited(self.project)
        assert not is_rate_limited.called
        assert not result.is_limited

    @mock.patch('sentry.quotas.redis.is_rate_limited', return_value=(False, False))
    def test_is_not_limited_without_rejections(self, is_rate_limited):
        self.get_organization_quota.return_value = (100, 60)
        self.get_project_quota.return_value = (200, 60)
        assert not self.quota.is_rate_limited(self.project).is_limited

    @mock.patch('sentry.quotas.redis.is_rate_limited', return_value=(True, False))
    def test_is_limited_on_rejections(self, is_rate_limited):
        self.get_organization_quota.return_value = (100, 60)
        self.get_project_quota.return_value = (200, 60)
        assert self.quota.is_rate_limited(self.project).is_limited

    @mock.patch.object(RedisQuota, 'get_quotas')
    @mock.patch('sentry.quotas.redis.is_rate_limited', return_value=(True, False))
    def test_not_limited_without_enforce(self, mock_is_rate_limited, mock_get_quotas):
        mock_get_quotas.return_value = (
            BasicRedisQuota(
                key='p:1',
                limit=1,
                window=1,
                reason_code='project_quota',
                enforce=False,
            ), BasicRedisQuota(
                key='p:2',
                limit=1,
                window=1,
                reason_code='project_quota',
                enforce=True,
            ),
        )

        assert not self.quota.is_rate_limited(self.project).is_limited

    @mock.patch.object(RedisQuota, 'get_quotas')
    @mock.patch('sentry.quotas.redis.is_rate_limited', return_value=(True, True))
    def test_limited_without_enforce(self, mock_is_rate_limited, mock_get_quotas):
        mock_get_quotas.return_value = (
            BasicRedisQuota(
                key='p:1',
                limit=1,
                window=1,
                reason_code='project_quota',
                enforce=False,
            ), BasicRedisQuota(
                key='p:2',
                limit=1,
                window=1,
                reason_code='project_quota',
                enforce=True,
            ),
        )

        assert self.quota.is_rate_limited(self.project).is_limited

    def test_get_usage(self):
        timestamp = time.time()

        self.get_project_quota.return_value = (200, 60)
        self.get_organization_quota.return_value = (300, 60)

        n = 10
        for _ in xrange(n):
            self.quota.is_rate_limited(self.project, timestamp=timestamp)

        quotas = self.quota.get_quotas(self.project)

        assert self.quota.get_usage(
            self.project.organization_id,
            quotas + [
                BasicRedisQuota(
                    key='unlimited',
                    limit=0,
                    window=60,
                    reason_code='unlimited',
                ),
                BasicRedisQuota(
                    key='dummy',
                    limit=10,
                    window=60,
                    reason_code='dummy',
                ),
            ],
            timestamp=timestamp,
        ) == [n for _ in quotas] + [None, 0]

    @mock.patch.object(RedisQuota, 'get_quotas')
    def test_refund(self, mock_get_quotas):
        timestamp = time.time()

        mock_get_quotas.return_value = (
            BasicRedisQuota(
                key='p:1',
                limit=1,
                window=1,
                reason_code='project_quota',
                enforce=False,
            ), BasicRedisQuota(
                key='p:2',
                limit=1,
                window=1,
                reason_code='project_quota',
                enforce=True,
            ),
        )

        self.quota.refund(self.project, timestamp=timestamp)
        client = self.quota.cluster.get_local_client_for_key(
            six.text_type(self.project.organization.pk)
        )

        keys = client.keys('r:quota:p:?:*')

        assert len(keys) == 2

        for key in keys:
            assert client.get(key) == '1'

    def test_get_usage_uses_refund(self):
        timestamp = time.time()

        self.get_project_quota.return_value = (200, 60)
        self.get_organization_quota.return_value = (300, 60)

        n = 10
        for _ in xrange(n):
            self.quota.is_rate_limited(self.project, timestamp=timestamp)

        self.quota.refund(self.project, timestamp=timestamp)

        quotas = self.quota.get_quotas(self.project)

        assert self.quota.get_usage(
            self.project.organization_id,
            quotas + [
                BasicRedisQuota(
                    key='unlimited',
                    limit=0,
                    window=60,
                    reason_code='unlimited',
                ),
                BasicRedisQuota(
                    key='dummy',
                    limit=10,
                    window=60,
                    reason_code='dummy',
                ),
            ],
            timestamp=timestamp,
            # the - 1 is because we refunded once
        ) == [n - 1 for _ in quotas] + [None, 0]
