# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.quotas.redis import RedisQuota
from sentry.testutils import TestCase


class RedisQuotaTest(TestCase):
    def setUp(self):
        self.quota = RedisQuota(hosts={
            0: {'db': 9}
        })
        self.quota.conn.flushdb()

    def test_default_host_is_local(self):
        quota = RedisQuota()
        self.assertEquals(len(quota.conn.hosts), 1)
        self.assertEquals(quota.conn.hosts[0].host, 'localhost')

    @mock.patch.object(RedisQuota, 'get_system_quota')
    @mock.patch.object(RedisQuota, 'get_project_quota')
    @mock.patch.object(RedisQuota, '_incr_project')
    def test_bails_immediately_without_quota(self, incr, get_project_quota, get_system_quota):
        get_system_quota.return_value = 0
        get_project_quota.return_value = 0
        incr.return_value = (0, 0)

        result = self.quota.is_rate_limited(self.project)

        get_project_quota.assert_called_once_with(self.project)
        assert not incr.called
        assert result is False

    @mock.patch.object(RedisQuota, 'get_system_quota')
    @mock.patch.object(RedisQuota, 'get_project_quota')
    @mock.patch.object(RedisQuota, '_incr_project')
    def test_over_quota(self, incr, get_project_quota, get_system_quota):
        get_project_quota.return_value = 100
        get_system_quota.return_value = 0
        incr.return_value = (0, 101)

        result = self.quota.is_rate_limited(self.project)

        incr.assert_called_once_with(self.project)
        assert result is True

    @mock.patch.object(RedisQuota, 'get_system_quota')
    @mock.patch.object(RedisQuota, 'get_project_quota')
    @mock.patch.object(RedisQuota, '_incr_project')
    def test_under_quota(self, incr, get_project_quota, get_system_quota):
        get_project_quota.return_value = 100
        get_system_quota.return_value = 0
        incr.return_value = (0, 99)

        result = self.quota.is_rate_limited(self.project)

        incr.assert_called_once_with(self.project)
        assert result is False
