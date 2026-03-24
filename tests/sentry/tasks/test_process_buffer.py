from unittest import mock

import pytest

from sentry.models.group import Group
from sentry.tasks.process_buffer import process_incr, process_pending
from sentry.testutils.cases import TestCase


class ProcessIncrTest(TestCase):
    def test_constraints_model_name(self) -> None:
        with pytest.raises(AssertionError) as err:
            process_incr(model_name="group", columns={"times_seen": 1}, filters={"pk": 1})
        assert "model_name must be in form" in str(err)

    @mock.patch("sentry.buffer.backend.process")
    def test_calls_process_with_model_name(self, process: mock.MagicMock) -> None:
        columns = {"times_seen": 1}
        filters = {"pk": 1}
        process_incr(model_name="sentry.Group", columns=columns, filters=filters)
        process.assert_called_once_with(
            model=Group, columns=columns, filters=filters, extra=None, signal_only=None
        )


class ProcessPendingTest(TestCase):
    @mock.patch("sentry.buffer.backend.process_pending")
    def test_nothing(self, mock_process_pending: mock.MagicMock) -> None:
        # this effectively just says "does the code run"
        process_pending()
        assert len(mock_process_pending.mock_calls) == 1
        mock_process_pending.assert_any_call()
