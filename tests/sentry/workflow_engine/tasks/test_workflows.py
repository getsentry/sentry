from unittest import mock

from sentry.locks import locks
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.tasks.workflows import schedule_delayed_workflows


class ScheduleDelayedWorkflowsTest(TestCase):
    @mock.patch("sentry.workflow_engine.processors.schedule.process_buffered_workflows")
    def test_schedule_delayed_workflows_locked_out(
        self,
        mock_process_buffered_workflows: mock.MagicMock,
    ) -> None:
        with self.options({"workflow_engine.use_new_scheduling_task": True}):
            with self.assertLogs(
                "sentry.workflow_engine.tasks.workflows", level="WARNING"
            ) as logger:
                lock = locks.get(
                    "workflow_engine:schedule_delayed_workflows",
                    duration=60,
                    name="schedule_delayed_workflows",
                )
                with lock.acquire():
                    schedule_delayed_workflows()
                    self.assertEqual(len(logger.output), 1)
                    assert len(mock_process_buffered_workflows.mock_calls) == 0

            with self.assertNoLogs("sentry.workflow_engine.tasks.workflows", level="WARNING"):
                schedule_delayed_workflows()
                assert len(mock_process_buffered_workflows.mock_calls) == 1
                mock_process_buffered_workflows.assert_called_with()

    @mock.patch("sentry.workflow_engine.processors.schedule.process_buffered_workflows")
    def test_schedule_delayed_workflows_config_option_false(
        self,
        mock_process_buffered_workflows: mock.MagicMock,
    ) -> None:
        with self.options({"workflow_engine.use_new_scheduling_task": False}):
            with self.assertLogs("sentry.workflow_engine.tasks.workflows", level="INFO") as logger:
                schedule_delayed_workflows()
                assert len(mock_process_buffered_workflows.mock_calls) == 0
                assert any(
                    "Configured to use process_pending_batch" in output for output in logger.output
                )

    @mock.patch("sentry.workflow_engine.processors.schedule.process_buffered_workflows")
    def test_schedule_delayed_workflows_normal_operation(
        self,
        mock_process_buffered_workflows: mock.MagicMock,
    ) -> None:
        with self.options({"workflow_engine.use_new_scheduling_task": True}):
            schedule_delayed_workflows()

        assert len(mock_process_buffered_workflows.mock_calls) == 1
        mock_process_buffered_workflows.assert_called_once_with()
