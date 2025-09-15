from unittest import mock

import pytest

from sentry.models.group import Group
from sentry.tasks.process_buffer import (
    get_process_lock,
    process_incr,
    process_pending,
    process_pending_batch,
    schedule_delayed_workflows,
)
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


class ProcessPendingBatchTest(TestCase):
    @mock.patch("sentry.rules.processing.buffer_processing.process_buffer")
    def test_process_pending_batch_locked_out(self, mock_process_buffer: mock.MagicMock) -> None:
        with self.assertLogs("sentry.tasks.process_buffer", level="WARNING") as logger:
            lock = get_process_lock("process_pending_batch")
            with lock.acquire():
                process_pending_batch()
                self.assertEqual(len(logger.output), 1)
                assert len(mock_process_buffer.mock_calls) == 0

        with self.assertNoLogs("sentry.tasks.process_buffer", level="WARNING"):
            process_pending_batch()
            assert len(mock_process_buffer.mock_calls) == 1


class ScheduleDelayedWorkflowsTest(TestCase):
    @mock.patch("sentry.options.get")
    @mock.patch("sentry.rules.processing.buffer_processing.process_buffer_for_type")
    @mock.patch("sentry.workflow_engine.tasks.delayed_workflows.DelayedWorkflow")
    def test_schedule_delayed_workflows_locked_out(
        self,
        mock_delayed_workflow: mock.MagicMock,
        mock_process_buffer_for_type: mock.MagicMock,
        mock_options_get: mock.MagicMock,
    ) -> None:
        # Mock the config option to return False (not using process_pending_batch)
        mock_options_get.return_value = False

        with self.assertLogs("sentry.tasks.process_buffer", level="WARNING") as logger:
            lock = get_process_lock("schedule_delayed_workflows")
            with lock.acquire():
                schedule_delayed_workflows()
                self.assertEqual(len(logger.output), 1)
                assert len(mock_process_buffer_for_type.mock_calls) == 0

        with self.assertNoLogs("sentry.tasks.process_buffer", level="WARNING"):
            schedule_delayed_workflows()
            assert len(mock_process_buffer_for_type.mock_calls) == 1
            mock_process_buffer_for_type.assert_called_with(
                "delayed_workflow", mock_delayed_workflow
            )

    @mock.patch("sentry.options.get")
    @mock.patch("sentry.rules.processing.buffer_processing.process_buffer_for_type")
    @mock.patch("sentry.workflow_engine.tasks.delayed_workflows.DelayedWorkflow")
    def test_schedule_delayed_workflows_config_option_true(
        self,
        mock_delayed_workflow: mock.MagicMock,
        mock_process_buffer_for_type: mock.MagicMock,
        mock_options_get: mock.MagicMock,
    ) -> None:
        # Mock the config option to return True (using process_pending_batch)
        mock_options_get.return_value = True

        with self.assertLogs("sentry.tasks.process_buffer", level="INFO") as logger:
            schedule_delayed_workflows()
            # Should log and exit without calling process_buffer_for_type
            assert len(mock_process_buffer_for_type.mock_calls) == 0
            assert any(
                "Configured to use process_pending_batch" in output for output in logger.output
            )

    @mock.patch("sentry.options.get")
    @mock.patch("sentry.rules.processing.buffer_processing.process_buffer_for_type")
    @mock.patch("sentry.workflow_engine.tasks.delayed_workflows.DelayedWorkflow")
    def test_schedule_delayed_workflows_normal_operation(
        self,
        mock_delayed_workflow: mock.MagicMock,
        mock_process_buffer_for_type: mock.MagicMock,
        mock_options_get: mock.MagicMock,
    ) -> None:
        # Mock the config option to return False (not using process_pending_batch)
        mock_options_get.return_value = False

        schedule_delayed_workflows()

        # Should only process delayed_workflow
        assert len(mock_process_buffer_for_type.mock_calls) == 1
        mock_process_buffer_for_type.assert_called_once_with(
            "delayed_workflow", mock_delayed_workflow
        )
