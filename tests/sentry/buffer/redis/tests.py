# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.db.models import F

from sentry.buffer.redis import RedisBuffer
from sentry.testutils import TestCase


class RedisBufferTest(TestCase):
    def setUp(self):
        self.buf = RedisBuffer(hosts={
            0: {'db': 9}
        })
        self.buf.conn.flushdb()

    def test_default_host_is_local(self):
        buf = RedisBuffer()
        assert len(buf.conn.hosts) == 1
        assert buf.conn.hosts[0].host == 'localhost'

    def test_make_key_response(self):
        callback = mock.Mock()
        callback.__module__ = 'test'
        callback.__name__ = 'callback'
        args = (1,)
        assert self.buf._make_key('foo', callback, args) == 'buffer:test.callback:foo:c4ca4238a0b923820dcc509a6f75849b'

    @mock.patch('sentry.buffer.redis.RedisBuffer._make_task_key', mock.Mock(return_value='foo'))
    @mock.patch('sentry.buffer.redis.RedisBuffer._make_lock_key', mock.Mock(return_value='bar'))
    @mock.patch('sentry.buffer.base.process_delay', mock.Mock())
    def test_delay_handles_nodes(self):
        callback = mock.Mock()
        args = ('foo')
        values = {'biz': 'baz', 'bar': F('bar') + 1}
        self.buf.delay(callback, args, values)
        self.buf.delay(callback, args, values)
        assert self.buf.conn.hgetall('foo') == {
            'biz': 'baz',
            'bar': '2',
        }

    @mock.patch('sentry.buffer.redis.RedisBuffer._make_task_key', mock.Mock(return_value='foo'))
    @mock.patch('sentry.buffer.redis.RedisBuffer._make_lock_key', mock.Mock(return_value='bar'))
    @mock.patch('sentry.buffer.base.Buffer.process')
    def test_process_does_not_save_empty_results(self, process):
        callback = mock.Mock()
        args = ('foo')
        values = {'biz': 'baz', 'bar': 1}
        self.buf.process(callback, args, values)
        assert not process.called

    @mock.patch('sentry.buffer.redis.RedisBuffer._make_task_key', mock.Mock(return_value='foo'))
    @mock.patch('sentry.buffer.redis.RedisBuffer._make_lock_key', mock.Mock(return_value='bar'))
    @mock.patch('sentry.buffer.base.Buffer.process')
    def test_process_calls_with_value_and_clear(self, process):
        callback = mock.Mock()
        args = ('foo')
        values = {'biz': 'baz', 'bar': F('bar') + 1}
        self.buf.conn.hset('foo', 'bar', 2)
        self.buf.process(callback, args, values)
        process.assert_called_once_with(callback, args, {'biz': 'baz', 'bar': 2})
        assert self.buf.conn.hgetall('foo') == {}
