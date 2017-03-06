# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.tasks.process_buffer import process_incr
from sentry.testutils import TestCase


class ProcessIncrTest(TestCase):
    @mock.patch('sentry.buffer.backend.process')
    def test_calls_process(self, process):
        model = mock.Mock()
        columns = {'times_seen': 1}
        filters = {'pk': 1}
        process_incr(model=model, columns=columns, filters=filters)
        process.assert_called_once_with(model=model, columns=columns, filters=filters)


class ProcessBufferTest(TestCase):
    @mock.patch('sentry.buffer.backend.process_pending')
    def test_nothing(self, process_pending):
        # this effectively just says "does the code run"
        process_pending.assert_called_once_with()
