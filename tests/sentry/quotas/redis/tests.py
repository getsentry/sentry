# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from exam import fixture, patcher

from sentry.quotas.redis import RedisQuota
from sentry.testutils import TestCase


class RedisQuotaTest(TestCase):
    @fixture
    def quota(self):
        inst = RedisQuota(hosts={
            0: {'db': 9}
        })
        inst.conn.flushdb()
        return inst

    @patcher.object(RedisQuota, 'get_system_quota')
    def get_system_quota(self):
        inst = mock.MagicMock()
        inst.return_value = 0
        return inst

    @patcher.object(RedisQuota, 'get_team_quota')
    def get_team_quota(self):
        inst = mock.MagicMock()
        inst.return_value = 0
        return inst

    @patcher.object(RedisQuota, 'get_project_quota')
    def get_project_quota(self):
        inst = mock.MagicMock()
        inst.return_value = 0
        return inst

    @patcher.object(RedisQuota, '_incr_project')
    def _incr_project(self):
        inst = mock.MagicMock()
        inst.return_value = (0, 0, 0)
        return inst

    def test_default_host_is_local(self):
        quota = RedisQuota()
        self.assertEquals(len(quota.conn.hosts), 1)
        self.assertEquals(quota.conn.hosts[0].host, 'localhost')

    def test_bails_immediately_without_any_quota(self):
        self._incr_project.return_value = (0, 0, 0)

        result = self.quota.is_rate_limited(self.project)

        assert not self._incr_project.called
        assert result is False

    def test_enforces_project_quota(self):
        self.get_project_quota.return_value = 100
        self._incr_project.return_value = (0, 0, 101)

        result = self.quota.is_rate_limited(self.project)

        assert result is True

        self._incr_project.return_value = (0, 0, 99)

        result = self.quota.is_rate_limited(self.project)

        assert result is False

    def test_enforces_team_quota(self):
        self.get_team_quota.return_value = 100
        self._incr_project.return_value = (0, 101, 0)

        result = self.quota.is_rate_limited(self.project)

        assert result is True

        self._incr_project.return_value = (0, 99, 0)

        result = self.quota.is_rate_limited(self.project)

        assert result is False

    def test_enforces_system_quota(self):
        self.get_system_quota.return_value = 100
        self._incr_project.return_value = (101, 0, 0)

        result = self.quota.is_rate_limited(self.project)

        assert result is True

        self._incr_project.return_value = (99, 0, 0)

        result = self.quota.is_rate_limited(self.project)

        assert result is False
