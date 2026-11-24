from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from sentry.cadence.api import ScheduledTriggerType, TriggerFiring, TriggerTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.schedules import (
    InvalidWorkflowSchedule,
    WorkflowFiring,
    WorkflowSchedule,
    WorkflowTriggerHandler,
    clear_workflow_schedule,
    get_workflow_schedules,
    scheduled_workflow_handler_registry,
    set_workflow_schedule,
)

SCHEDULED_FOR = datetime(2024, 3, 10, 9, 0, tzinfo=UTC)


class WorkflowScheduleTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.handler = MagicMock()
        self.enterContext(
            patch.dict(
                scheduled_workflow_handler_registry.registrations,
                {Workflow.Type.SEER_INVESTIGATION: self.handler},
            )
        )
        self.workflow = self.create_workflow(
            organization=self.organization, type=Workflow.Type.SEER_INVESTIGATION
        )

    def firing(self, workflow: Workflow) -> TriggerFiring:
        return TriggerFiring(
            organization_id=workflow.organization_id,
            trigger_type=ScheduledTriggerType.WORKFLOW,
            target_id=workflow.id,
            scheduled_for=SCHEDULED_FOR,
            next_scheduled_for=SCHEDULED_FOR + timedelta(days=1),
        )

    @freeze_time("2024-03-09 12:00:00")
    def test_set_schedule_is_read_back(self) -> None:
        assert set_workflow_schedule(self.workflow, cron="0 9 * * *", timezone="America/New_York")

        schedule = get_workflow_schedules([self.workflow])[self.workflow.id]
        assert schedule.cron == "0 9 * * *"
        assert schedule.timezone == "America/New_York"
        # 09:00 in New York, spread over the following hour.
        scheduled_for = datetime(2024, 3, 9, 14, 0, tzinfo=UTC)
        assert schedule.next_run_at is not None
        assert scheduled_for <= schedule.next_run_at < scheduled_for + timedelta(hours=1)

    def test_setting_the_same_schedule_changes_nothing(self) -> None:
        set_workflow_schedule(self.workflow, cron="0 9 * * *")

        assert not set_workflow_schedule(self.workflow, cron="0 9 * * *")
        assert set_workflow_schedule(self.workflow, cron="0 10 * * *")

    def test_rejects_an_invalid_schedule(self) -> None:
        with pytest.raises(InvalidWorkflowSchedule):
            set_workflow_schedule(self.workflow, cron="not a cron")
        with pytest.raises(InvalidWorkflowSchedule):
            set_workflow_schedule(self.workflow, cron="0 9 * * *", timezone="Mars/Olympus")

        assert get_workflow_schedules([self.workflow]) == {}

    def test_disabled_workflow_keeps_its_schedule_without_a_next_run(self) -> None:
        set_workflow_schedule(self.workflow, cron="0 9 * * *")
        self.workflow.update(enabled=False)

        assert get_workflow_schedules([self.workflow]) == {
            self.workflow.id: WorkflowSchedule(cron="0 9 * * *", timezone="UTC", next_run_at=None)
        }

    def test_clear_removes_the_schedule(self) -> None:
        set_workflow_schedule(self.workflow, cron="0 9 * * *")

        clear_workflow_schedule(self.workflow)

        assert get_workflow_schedules([self.workflow]) == {}

    def test_firings_reach_the_handler_of_the_workflow_type(self) -> None:
        disabled = self.create_workflow(
            organization=self.organization,
            type=Workflow.Type.SEER_INVESTIGATION,
            enabled=False,
        )

        WorkflowTriggerHandler().dispatch([self.firing(self.workflow), self.firing(disabled)])

        self.handler.assert_called_once_with(
            [
                WorkflowFiring(
                    organization_id=self.organization.id,
                    workflow_id=self.workflow.id,
                    scheduled_for=SCHEDULED_FOR,
                )
            ]
        )

    def test_find_missing_reports_deleted_workflows(self) -> None:
        existing = TriggerTarget(organization_id=self.organization.id, target_id=self.workflow.id)
        deleted = TriggerTarget(
            organization_id=self.organization.id, target_id=self.workflow.id + 1
        )

        assert WorkflowTriggerHandler().find_missing([existing, deleted]) == [deleted]
