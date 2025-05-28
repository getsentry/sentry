from unittest import mock

import pytest

from sentry.models.group import Group
from sentry.tasks.process_buffer import (
    get_process_lock,
    process_incr,
    process_pending,
    process_pending_batch,
)
from sentry.testutils.cases import TestCase


class ProcessIncrTest(TestCase):
    def test_constraints_model_name(self):
        with pytest.raises(AssertionError) as err:
            process_incr(model_name="group", columns={"times_seen": 1}, filters={"pk": 1})
        assert "model_name must be in form" in str(err)

    @mock.patch("sentry.buffer.backend.process")
    def test_calls_process_with_model_name(self, process):
        columns = {"times_seen": 1}
        filters = {"pk": 1}
        process_incr(model_name="sentry.Group", columns=columns, filters=filters)
        process.assert_called_once_with(
            model=Group, columns=columns, filters=filters, extra=None, signal_only=None
        )


class ProcessPendingTest(TestCase):
    @mock.patch("sentry.buffer.backend.process_pending")
    def test_nothing(self, mock_process_pending):
        # this effectively just says "does the code run"
        process_pending()
        assert len(mock_process_pending.mock_calls) == 1
        mock_process_pending.assert_any_call()


class ProcessPendingBatchTest(TestCase):
    @mock.patch("sentry.buffer.backend.process_batch")
    def test_process_pending_batch(self, mock_process_pending_batch):
        process_pending_batch()
        assert len(mock_process_pending_batch.mock_calls) == 1
        mock_process_pending_batch.assert_any_call()

    @mock.patch("sentry.buffer.backend.process_batch")
    def test_process_pending_batch_locked_out(self, mock_process_pending_batch):
        with self.assertLogs("sentry.tasks.process_buffer", level="WARNING") as logger:
            lock = get_process_lock("process_pending_batch")
            with lock.acquire():
                process_pending_batch()
                self.assertEqual(len(logger.output), 1)
                assert len(mock_process_pending_batch.mock_calls) == 0

        with self.assertNoLogs("sentry.tasks.process_buffer", level="WARNING"):
            process_pending_batch()
            assert len(mock_process_pending_batch.mock_calls) == 1
