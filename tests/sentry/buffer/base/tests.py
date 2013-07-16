# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.buffer.base import Buffer
from sentry.testutils import TestCase


class BufferTest(TestCase):
    def setUp(self):
        self.buf = Buffer()

    @mock.patch('sentry.buffer.base.process_delay')
    def test_delay_sends_to_queue(self, process_delay):
        callback = mock.Mock()
        args = ('foo')
        values = {'biz': 'baz'}
        kwargs = dict(callback=callback, args=args, values=values)
        self.buf.delay(**kwargs)
        process_delay.apply_async.assert_called_once_with(
            kwargs=kwargs, countdown=5)

    def test_process_calls_callback(self):
        callback = mock.Mock()
        args = ('foo')
        values = {'biz': 'baz'}
        self.buf.process(callback, args, values)
        callback.assert_callced_once_with('foo', values=values)
