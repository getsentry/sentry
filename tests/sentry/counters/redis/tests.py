# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

# from datetime import timedelta
# from django.utils import timezone
from sentry.counters.redis import RedisCounter
# from sentry.models import Group, Project
from sentry.testutils import TestCase, fixture


class RedisCounterTest(TestCase):
    @fixture
    def counter(self):
        counter = RedisCounter(hosts={
            0: {'db': 9}
        })
        counter.conn.flushdb()
        return counter

    def test_default_host_is_local(self):
        counter = RedisCounter()
        self.assertEquals(len(counter.conn.hosts), 1)
        self.assertEquals(counter.conn.hosts[0].host, 'localhost')

    @mock.patch('sentry.counters.redis.time')
    def test_make_key_response(self, time):
        time = time.time

        time.return_value = 1360644295.816033
        assert self.counter._make_key('team_id', 1) == 'sentry.counters:22677404:0:team_id=1'
        time.assert_called_once_with()

        now = 1360654295.816033
        assert self.counter._make_key('team_id', 1, now, unique=True) == 'sentry.counters:22677571:1:team_id=1'

        assert self.counter._make_key('project_id', 'foo', now, unique=True) == 'sentry.counters:22677571:1:project_id=foo'
