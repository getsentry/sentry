# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.buffer.redis import RedisBuffer
from sentry.models import Group, Project
from sentry.tasks.process_buffer import process_incr
from tests.base import TestCase


class RedisBufferTest(TestCase):
    def setUp(self):
        self.buf = RedisBuffer(hosts={
            0: {'db': 9}
        })
        self.buf.conn.flushdb()

    def test_default_host_is_local(self):
        buf = RedisBuffer()
        self.assertEquals(len(buf.conn.hosts), 1)
        self.assertEquals(buf.conn.hosts[0].host, 'localhost')

    def test_map_column_handles_foreignkeys(self):
        self.assertEquals(self.buf._map_column(Group, 'project', Project(id=1)), 1)

    def test_make_key_response(self):
        column = 'times_seen'
        filters = {'pk': 1}
        self.assertEquals(self.buf._make_key(Group, filters, column), 'sentry.group:88b48b31b5f100719c64316596b10b0f:times_seen')

    @mock.patch('sentry.buffer.redis.RedisBuffer._make_key', mock.Mock(return_value='foo'))
    @mock.patch('sentry.buffer.base.maybe_delay')
    def test_incr_delays_task(self, maybe_delay):
        model = mock.Mock()
        columns = {'times_seen': 1}
        filters = {'pk': 1}
        self.buf.incr(model, columns, filters)
        maybe_delay.assert_called_once_with(process_incr, model=model, columns=columns, filters=filters)

    @mock.patch('sentry.buffer.redis.RedisBuffer._make_key', mock.Mock(return_value='foo'))
    @mock.patch('sentry.buffer.base.maybe_delay', mock.Mock())
    def test_incr_does_buffer_to_conn(self):
        model = mock.Mock()
        columns = {'times_seen': 1}
        filters = {'pk': 1}
        self.buf.incr(model, columns, filters)
        self.assertEquals(self.buf.conn.get('foo'), '1')

    @mock.patch('sentry.buffer.redis.RedisBuffer._make_key', mock.Mock(return_value='foo'))
    @mock.patch('sentry.buffer.base.Buffer.process')
    def test_process_does_not_save_empty_results(self, process):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'pk': group.pk}
        self.buf.process(Group, columns, filters)
        self.assertFalse(process.called)

    @mock.patch('sentry.buffer.redis.RedisBuffer._make_key', mock.Mock(return_value='foo'))
    @mock.patch('sentry.buffer.base.Buffer.process')
    def test_process_does_save_call_with_results(self, process):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'pk': group.pk}
        self.buf.conn.set('foo', 2)
        self.buf.process(Group, columns, filters)
        process.assert_called_once_with(Group, {'times_seen': 2}, filters)

    @mock.patch('sentry.buffer.redis.RedisBuffer._make_key', mock.Mock(return_value='foo'))
    @mock.patch('sentry.buffer.base.Buffer.process')
    def test_process_does_clear_buffer(self, process):
        group = Group.objects.create(project=Project(id=1))
        columns = {'times_seen': 1}
        filters = {'pk': group.pk}
        self.buf.conn.set('foo', 2)
        self.buf.process(Group, columns, filters)
        self.assertEquals(self.buf.conn.get('foo'), '0')
