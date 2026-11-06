from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, call, patch
from zoneinfo import ZoneInfo

from sentry.cadence.api import ScheduledTriggerType, TriggerFiring, get_schedules
from sentry.cadence.tasks import cadence_tick
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowRun,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.seer.workflows.scheduled import (
    enqueue_scheduled_automation_runs,
    record_scheduled_automation_run,
    trigger_key_for,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options

SCHEDULED_FOR = datetime(2024, 3, 10, 10, 0, tzinfo=UTC)


def enable(config: SeerWorkflowConfig) -> None:
    with SeerWorkflow(
        config_id=config.id, organization_id=config.organization_id
    ).update_config() as update:
        update.set_enabled(True)


def test_trigger_key_is_the_scheduled_minute_in_utc() -> None:
    assert trigger_key_for(SCHEDULED_FOR) == "cron:2024-03-10T10:00"
    assert (
        trigger_key_for(SCHEDULED_FOR.astimezone(ZoneInfo("America/New_York")))
        == "cron:2024-03-10T10:00"
    )


class EnqueueScheduledAutomationRunsTest(TestCase):
    @patch("sentry.seer.workflows.scheduled.record_scheduled_automation_run.apply_async")
    def test_enqueues_a_task_per_firing(self, mock_apply_async: MagicMock) -> None:
        firings = [
            TriggerFiring(
                organization_id=self.organization.id,
                trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
                target_id=config_id,
                scheduled_for=SCHEDULED_FOR,
            )
            for config_id in (11, 12)
        ]

        enqueue_scheduled_automation_runs(firings)

        assert mock_apply_async.call_args_list == [
            call(
                kwargs={
                    "organization_id": self.organization.id,
                    "config_id": config_id,
                    "scheduled_for": SCHEDULED_FOR.isoformat(),
                },
                headers={"sentry-propagate-traces": False},
            )
            for config_id in (11, 12)
        ]


@with_feature("organizations:seer-automations")
class RecordScheduledAutomationRunTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        enable(self.config)

    def run_task(self, config_id: int | None = None) -> None:
        record_scheduled_automation_run(
            organization_id=self.organization.id,
            config_id=config_id or self.config.id,
            scheduled_for=SCHEDULED_FOR.isoformat(),
        )

    def runs(self) -> list[SeerWorkflowRun]:
        return list(SeerWorkflowRun.objects.filter(workflow_config_id=self.config.id))

    def is_scheduled(self, config_id: int | None = None) -> bool:
        config_id = config_id or self.config.id
        return config_id in get_schedules(
            organization_id=self.organization.id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=[config_id],
        )

    def test_records_a_cron_run(self) -> None:
        self.run_task()

        (run,) = self.runs()
        assert run.trigger_key == "cron:2024-03-10T10:00"
        assert run.status == SeerWorkflowRunStatus.COMPLETE
        snapshot = SeerWorkflowRunLifecycle(
            run_id=run.id, organization_id=run.organization_id
        ).extras.snapshot
        assert snapshot.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        assert snapshot.inputs == {"source": "cron", "scheduled_for": "2024-03-10T10:00:00+00:00"}

    def test_duplicate_delivery_records_one_run(self) -> None:
        self.run_task()
        self.run_task()

        assert len(self.runs()) == 1

    @patch("sentry.seer.workflows.scheduled.metrics.incr")
    def test_records_outcome(self, mock_incr: MagicMock) -> None:
        self.run_task()
        self.run_task()

        assert [
            c for c in mock_incr.call_args_list if c.args[0] == "seer.workflow.scheduled_run"
        ] == [
            call(
                "seer.workflow.scheduled_run",
                tags={"outcome": "accepted", "reason": "none"},
                sample_rate=1.0,
            ),
            call(
                "seer.workflow.scheduled_run",
                tags={"outcome": "duplicate", "reason": "none"},
                sample_rate=1.0,
            ),
        ]

    def test_quota_exceeded_rejects_the_run(self) -> None:
        with patch.object(SeerWorkflow, "has_quota_available", return_value=False):
            self.run_task()

        (run,) = self.runs()
        assert run.status == SeerWorkflowRunStatus.REJECTED

    def test_feature_disabled_keeps_the_schedule(self) -> None:
        with self.feature({"organizations:seer-automations": False}):
            self.run_task()

        assert self.runs() == []
        assert self.is_scheduled()

    def test_disabled_config_clears_its_stale_schedule(self) -> None:
        # Disabled without going through update_config, so the schedule was left behind.
        SeerWorkflowConfig.objects.filter(id=self.config.id).update(enabled=False)

        self.run_task()

        assert self.runs() == []
        assert not self.is_scheduled()

    def test_deleted_config_clears_its_stale_schedule(self) -> None:
        config_id = self.config.id
        self.config.delete()

        self.run_task(config_id)

        assert not self.is_scheduled(config_id)

    def test_config_from_another_organization_is_ignored(self) -> None:
        other = Factories.create_seer_workflow_config(
            self.create_organization(), strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        enable(other)

        self.run_task(other.id)

        assert not SeerWorkflowRun.objects.filter(workflow_config_id=other.id).exists()
        assert get_schedules(
            organization_id=other.organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=[other.id],
        )


@with_feature("organizations:seer-automations")
class ScheduledAutomationEndToEndTest(TestCase):
    def test_cadence_tick_records_the_due_run(self) -> None:
        with freeze_time(SCHEDULED_FOR - timedelta(hours=1)):
            config = Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )
            enable(config)

        # Past the end of the spread window, so the firing is due whatever its offset.
        with (
            freeze_time(SCHEDULED_FOR + timedelta(hours=1)),
            override_options({"cadence.tick.enabled": True}),
            self.tasks(),
        ):
            cadence_tick()

        (run,) = SeerWorkflowRun.objects.filter(workflow_config_id=config.id)
        assert run.trigger_key == "cron:2024-03-10T10:00"
        assert run.status == SeerWorkflowRunStatus.COMPLETE
        (info,) = get_schedules(
            organization_id=self.organization.id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=[config.id],
        ).values()
        assert info.next_scheduled_for == SCHEDULED_FOR + timedelta(days=1)
