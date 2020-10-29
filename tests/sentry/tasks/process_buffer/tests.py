# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.compat import mock

from sentry.tasks.process_buffer import process_incr, process_pending
from sentry.testutils import TestCase


class ProcessIncrTest(TestCase):
    @mock.patch("sentry.buffer.backend.process")
    def test_calls_process(self, process):
        model = mock.Mock()
        columns = {"times_seen": 1}
        filters = {"pk": 1}
        process_incr(model=model, columns=columns, filters=filters)
        process.assert_called_once_with(model=model, columns=columns, filters=filters)


class ProcessPendingTest(TestCase):
    @mock.patch("sentry.buffer.backend.process_pending")
    def test_nothing(self, mock_process_pending):
        # this effectively just says "does the code run"
        process_pending()
        assert len(mock_process_pending.mock_calls) == 1
        mock_process_pending.assert_any_call(partition=None)

        process_pending(partition=1)
        assert len(mock_process_pending.mock_calls) == 2
        mock_process_pending.assert_any_call(partition=1)
