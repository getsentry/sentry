from datetime import UTC, datetime

from sentry.cadence.api import ScheduledTriggerType, cron, get_schedules
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.schedule import (
    schedule_for,
    sync_schedule,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time


class ScheduleForTest(TestCase):
    def test_enabled_daily_config_runs_daily(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, enabled=True
        )
        assert schedule_for(config) == cron("0 10 * * *")

    def test_config_cron_overrides_the_daily_schedule(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            enabled=True,
            extras={"trigger_settings": {"cron": "0 9 * * 1"}},
        )
        assert schedule_for(config) == cron("0 9 * * 1")

    def test_config_cron_runs_in_its_timezone(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            enabled=True,
            extras={"trigger_settings": {"cron": "0 9 * * 1", "timezone": "America/New_York"}},
        )
        assert schedule_for(config) == cron("0 9 * * 1", "America/New_York")

    def test_disabled_config_is_unscheduled(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, enabled=False
        )
        assert schedule_for(config) is None


class SyncScheduleTest(TestCase):
    def next_run(self, config: SeerWorkflowConfig) -> datetime | None:
        info = get_schedules(
            organization_id=config.organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=[config.id],
        ).get(config.id)
        return info.next_scheduled_for if info else None

    @freeze_time("2024-03-09 12:00:00")
    def test_sets_and_clears(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2, enabled=True
        )

        sync_schedule(config)
        assert self.next_run(config) == datetime(2024, 3, 10, 10, 0, tzinfo=UTC)

        config.enabled = False
        sync_schedule(config)
        assert self.next_run(config) is None
