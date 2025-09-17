from unittest import mock

from sentry.locks import locks
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.tasks.workflows import schedule_delayed_workflows


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
        # Mock the config option to return True (using new scheduling task)
        mock_options_get.return_value = True

        with self.assertLogs("sentry.workflow_engine.tasks.workflows", level="WARNING") as logger:
            lock = locks.get(
                "workflow_engine:schedule_delayed_workflows",
                duration=60,
                name="schedule_delayed_workflows",
            )
            with lock.acquire():
                schedule_delayed_workflows()
                self.assertEqual(len(logger.output), 1)
                assert len(mock_process_buffer_for_type.mock_calls) == 0

        with self.assertNoLogs("sentry.workflow_engine.tasks.workflows", level="WARNING"):
            schedule_delayed_workflows()
            assert len(mock_process_buffer_for_type.mock_calls) == 1
            mock_process_buffer_for_type.assert_called_with(
                "delayed_workflow", mock_delayed_workflow
            )

    @mock.patch("sentry.options.get")
    @mock.patch("sentry.rules.processing.buffer_processing.process_buffer_for_type")
    @mock.patch("sentry.workflow_engine.tasks.delayed_workflows.DelayedWorkflow")
    def test_schedule_delayed_workflows_config_option_false(
        self,
        mock_delayed_workflow: mock.MagicMock,
        mock_process_buffer_for_type: mock.MagicMock,
        mock_options_get: mock.MagicMock,
    ) -> None:
        # Mock the config option to return False (not using new scheduling task)
        mock_options_get.return_value = False

        with self.assertLogs("sentry.workflow_engine.tasks.workflows", level="INFO") as logger:
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
        # Mock the config option to return True (using new scheduling task)
        mock_options_get.return_value = True

        schedule_delayed_workflows()

        # Should only process delayed_workflow
        assert len(mock_process_buffer_for_type.mock_calls) == 1
        mock_process_buffer_for_type.assert_called_once_with(
            "delayed_workflow", mock_delayed_workflow
        )
