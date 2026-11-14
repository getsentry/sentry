from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, call, patch
from zoneinfo import ZoneInfo

import pytest

from sentry.cadence.api import (
    ScheduledTriggerType,
    TriggerFiring,
    TriggerTarget,
    cron,
    get_schedules,
)
from sentry.cadence.registry import trigger_type_registry
from sentry.cadence.tasks import cadence_tick
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.base import AutomationDefinition
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.seer.workflows.scheduled import (
    SCHEDULED_EXECUTION_FEATURE,
    PromptedInvestigationAction,
    ScheduledRunInputs,
    SeerWorkflowTriggerHandler,
    record_scheduled_automation_run,
    schedule_for,
    sync_schedule,
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


class SeerWorkflowTriggerHandlerTest(TestCase):
    def test_is_registered(self) -> None:
        assert isinstance(
            trigger_type_registry.get(ScheduledTriggerType.SEER_WORKFLOW),
            SeerWorkflowTriggerHandler,
        )

    def test_find_missing_reports_deleted_configs(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )
        existing = TriggerTarget(organization_id=self.organization.id, target_id=config.id)
        deleted = TriggerTarget(organization_id=self.organization.id, target_id=config.id + 1)

        assert SeerWorkflowTriggerHandler().find_missing([existing, deleted]) == [deleted]

    @patch("sentry.seer.workflows.scheduled.record_scheduled_automation_run.apply_async")
    def test_enqueues_a_task_per_firing(self, mock_apply_async: MagicMock) -> None:
        firings = [
            TriggerFiring(
                organization_id=self.organization.id,
                trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
                target_id=config_id,
                scheduled_for=SCHEDULED_FOR,
                next_scheduled_for=SCHEDULED_FOR + timedelta(days=1),
            )
            for config_id in (11, 12)
        ]

        SeerWorkflowTriggerHandler().dispatch(firings)

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


@with_feature(["organizations:seer-automations", SCHEDULED_EXECUTION_FEATURE])
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

    @patch.object(PromptedInvestigationAction, "dispatch")
    def test_admits_a_cron_run_and_delegates_dispatch(self, mock_dispatch: MagicMock) -> None:
        self.run_task()

        (run,) = self.runs()
        assert run.trigger_key == "cron:2024-03-10T10:00"
        assert run.status == SeerWorkflowRunStatus.RUNNING
        assert run.date_completed is None
        assert not run.executions.exists()
        mock_dispatch.assert_called_once_with(
            self.config,
            SeerWorkflowRunLifecycle(run_id=run.id, organization_id=run.organization_id),
            ScheduledRunInputs(scheduled_for=SCHEDULED_FOR),
        )
        snapshot = SeerWorkflowRunLifecycle(
            run_id=run.id, organization_id=run.organization_id
        ).extras.snapshot
        assert snapshot.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        assert snapshot.inputs == {"source": "cron", "scheduled_for": "2024-03-10T10:00:00+00:00"}

    @patch.object(PromptedInvestigationAction, "dispatch")
    def test_duplicate_delivery_records_one_run(self, mock_dispatch: MagicMock) -> None:
        self.run_task()
        self.run_task()

        assert len(self.runs()) == 1
        mock_dispatch.assert_called_once()

    @patch("sentry.seer.workflows.scheduled.metrics.incr")
    @patch.object(PromptedInvestigationAction, "dispatch")
    def test_records_outcome(self, mock_dispatch: MagicMock, mock_incr: MagicMock) -> None:
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

    def test_unimplemented_dispatch_rolls_back_admission(self) -> None:
        with pytest.raises(NotImplementedError, match="dispatch is not implemented"):
            self.run_task()

        assert self.runs() == []
        assert not SeerWorkflowRunExecution.objects.filter(
            run__organization_id=self.organization.id
        ).exists()
        assert self.is_scheduled()

    @patch.object(PromptedInvestigationAction, "dispatch")
    def test_failed_dispatch_can_retry_admission(self, mock_dispatch: MagicMock) -> None:
        mock_dispatch.side_effect = RuntimeError("dispatch failed")
        with pytest.raises(RuntimeError, match="dispatch failed"):
            self.run_task()
        assert self.runs() == []

        mock_dispatch.side_effect = None
        self.run_task()

        (run,) = self.runs()
        assert run.status == SeerWorkflowRunStatus.RUNNING
        assert mock_dispatch.call_count == 2

    @patch("sentry.seer.workflows.scheduled._record_scheduled_run")
    def test_execution_disabled_keeps_schedule_without_admitting_a_run(
        self, mock_record_run: MagicMock
    ) -> None:
        with self.feature({SCHEDULED_EXECUTION_FEATURE: False}):
            self.run_task()

        mock_record_run.assert_not_called()
        assert self.runs() == []
        assert self.is_scheduled()

    def test_quota_exceeded_rejects_the_run(self) -> None:
        with patch.object(AutomationDefinition, "has_quota_available", return_value=False):
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
    @patch("sentry.seer.workflows.scheduled.logger.info")
    def test_cadence_tick_reaches_disabled_execution_without_creating_history(
        self, mock_log: MagicMock
    ) -> None:
        with freeze_time(SCHEDULED_FOR - timedelta(hours=1)):
            config = Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )
            enable(config)
        (scheduled,) = get_schedules(
            organization_id=self.organization.id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=[config.id],
        ).values()
        assert scheduled.next_scheduled_for == SCHEDULED_FOR
        assert scheduled.next_fire_at is not None

        with (
            freeze_time(scheduled.next_fire_at),
            override_options({"cadence.tick.enabled": True}),
            self.tasks(),
        ):
            cadence_tick()

        assert not SeerWorkflowRun.objects.filter(workflow_config_id=config.id).exists()
        assert not SeerWorkflowRunExecution.objects.filter(
            run__workflow_config_id=config.id
        ).exists()
        mock_log.assert_called_once_with(
            "seer.workflow.scheduled_run",
            extra={
                "organization_id": self.organization.id,
                "config_id": config.id,
                "scheduled_for": SCHEDULED_FOR.isoformat(),
                "outcome": "ignored",
                "reason": "execution_disabled",
                "run_id": None,
            },
        )
        (info,) = get_schedules(
            organization_id=self.organization.id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=[config.id],
        ).values()
        assert info.next_scheduled_for == SCHEDULED_FOR + timedelta(days=1)


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
