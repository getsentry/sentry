# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.counters.redis import RedisCounter
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

    def test_all_the_things(self):
        self.counter.incr(1, team_id=1, project_id=1, group_id=1, created=False)
        self.counter.incr(1, team_id=1, project_id=1, group_id=1, created=True)
        self.counter.incr(1, team_id=1, project_id=2, group_id=1, created=False)
        self.counter.incr(2, team_id=1, project_id=2, group_id=2, created=True)
        assert self.counter.total('team_id', 1) == 5
        assert self.counter.total('project_id', 1) == 2
        assert self.counter.total('project_id', 2) == 3
        assert self.counter.total('group_id', 1) == 3
        assert self.counter.total('group_id', 2) == 2
        assert self.counter.unique('team_id', 1) == 3
        assert self.counter.unique('project_id', 1) == 1
        assert self.counter.unique('project_id', 2) == 2
        assert self.counter.unique('group_id', 1) == 1
        assert self.counter.unique('group_id', 2) == 2
