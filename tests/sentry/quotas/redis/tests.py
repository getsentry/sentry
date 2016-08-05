# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import six
import time

from exam import fixture, patcher

from sentry.quotas.redis import (
    is_rate_limited,
    RedisQuota,
)
from sentry.testutils import TestCase
from sentry.utils.redis import clusters


def test_is_rate_limited_script():
    now = int(time.time())

    cluster = clusters.get('default')
    client = cluster.get_local_client(six.next(iter(cluster.hosts)))

    # The item should not be rate limited by either key.
    assert list(map(bool, is_rate_limited(client, ('foo', 'bar'), (1, now + 60, 2, now + 120)))) == \
        [False, False]

    # The item should be rate limited by the first key (1).
    assert list(map(bool, is_rate_limited(client, ('foo', 'bar'), (1, now + 60, 2, now + 120)))) == \
        [True, False]

    # The item should still be rate limited by the first key (1), but *not*
    # rate limited by the second key (2) even though this is the third time
    # we've checked the quotas. This ensures items that are rejected by a lower
    # quota don't affect unrelated items that share a parent quota.
    assert list(map(bool, is_rate_limited(client, ('foo', 'bar'), (1, now + 60, 2, now + 120)))) == \
        [True, False]

    assert client.get('foo') == '1'
    assert 59 <= client.ttl('foo') <= 60

    assert client.get('bar') == '1'
    assert 119 <= client.ttl('bar') <= 120


class RedisQuotaTest(TestCase):
    quota = fixture(RedisQuota)

    @patcher.object(RedisQuota, 'get_project_quota')
    def get_project_quota(self):
        inst = mock.MagicMock()
        inst.return_value = 0
        return inst

    @patcher.object(RedisQuota, 'get_organization_quota')
    def get_organization_quota(self):
        inst = mock.MagicMock()
        inst.return_value = 0
        return inst

    def test_uses_defined_quotas(self):
        self.get_project_quota.return_value = 200
        self.get_organization_quota.return_value = 300
        assert set(self.quota.get_quotas(self.project)) == set((
            ('p:{}'.format(self.project.id), 200, 60),
            ('o:{}'.format(self.project.organization.id), 300, 60),
        ))

    @mock.patch('sentry.quotas.redis.is_rate_limited')
    @mock.patch.object(RedisQuota, 'get_quotas', return_value=[])
    def test_bails_immediately_without_any_quota(self, get_quotas, is_rate_limited):
        result = self.quota.is_rate_limited(self.project)
        assert not is_rate_limited.called
        assert not result.is_limited

    @mock.patch('sentry.quotas.redis.is_rate_limited', return_value=(False, False))
    def test_is_not_limited_without_rejections(self, is_rate_limited):
        self.get_organization_quota.return_value = 100
        self.get_project_quota.return_value = 200
        assert not self.quota.is_rate_limited(self.project).is_limited

    @mock.patch('sentry.quotas.redis.is_rate_limited', return_value=(True, False))
    def test_is_limited_on_rejections(self, is_rate_limited):
        self.get_organization_quota.return_value = 100
        self.get_project_quota.return_value = 200
        assert self.quota.is_rate_limited(self.project).is_limited
