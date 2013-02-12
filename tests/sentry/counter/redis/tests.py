# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.counter.redis import RedisCounter
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

    @mock.patch('sentry.counter.redis.time')
    def test_make_key_response(self, time):
        time = time.time

        time.return_value = 1360644295.816033
        assert self.counter._make_key('project', is_new=False) == 'sentry.counter:project:22677404:0'
        time.assert_called_once_with()

        now = 1360654295.816033
        assert self.counter._make_key('team', now, is_new=True) == 'sentry.counter:team:22677571:1'

    def test_all_the_things(self):
        self.counter.incr(self.group, is_new=False)
        self.counter.incr(self.group, is_new=False)
        self.counter.incr(self.group, is_new=True)
        assert self.counter.total(self.project) == 3
        assert self.counter.new(self.project) == 1
