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
        with self.assertLogs("sentry.workflow_engine.tasks.workflows", level="WARNING") as logger:
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
            mock_process_buffered_workflows.assert_called_with(mock.ANY)

    @mock.patch("sentry.workflow_engine.processors.schedule.process_buffered_workflows")
    def test_schedule_delayed_workflows_normal_operation(
        self,
        mock_process_buffered_workflows: mock.MagicMock,
    ) -> None:
        schedule_delayed_workflows()

        assert len(mock_process_buffered_workflows.mock_calls) == 1
        mock_process_buffered_workflows.assert_called_once_with(mock.ANY)
