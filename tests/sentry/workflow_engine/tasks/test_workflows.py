from typing import int
from unittest import TestCase, mock
from unittest.mock import MagicMock, patch

from sentry.locks import locks
from sentry.workflow_engine.tasks.workflows import schedule_delayed_workflows


class ScheduleDelayedWorkflowsTest(TestCase):
    @patch("sentry.workflow_engine.processors.schedule.process_buffered_workflows")
    def test_schedule_delayed_workflows_locked_out(
        self,
        mock_process_buffered_workflows: MagicMock,
    ) -> None:
        lock = locks.get(
            "workflow_engine:schedule_delayed_workflows",
            duration=60,
            name="schedule_delayed_workflows",
        )
        with lock.acquire():
            # Lock already held; no call.
            schedule_delayed_workflows()
            assert len(mock_process_buffered_workflows.mock_calls) == 0

        # Lock not held; call.
        schedule_delayed_workflows()
        assert len(mock_process_buffered_workflows.mock_calls) == 1
        mock_process_buffered_workflows.assert_called_with(mock.ANY)

    @patch("sentry.workflow_engine.processors.schedule.process_buffered_workflows")
    def test_schedule_delayed_workflows_normal_operation(
        self,
        mock_process_buffered_workflows: MagicMock,
    ) -> None:
        schedule_delayed_workflows()

        assert len(mock_process_buffered_workflows.mock_calls) == 1
        mock_process_buffered_workflows.assert_called_once_with(mock.ANY)
