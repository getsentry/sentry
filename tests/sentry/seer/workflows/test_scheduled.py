from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import pytest

from sentry.cadence.tasks import cadence_tick
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunSource,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.base import WorkflowUpdateError
from sentry.seer.workflows.scheduled import (
    DEFAULT_CRON,
    SCHEDULED_EXECUTION_FEATURE,
    dispatch_scheduled_automations,
    record_scheduled_automation_run,
    trigger_key_for,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.schedules import (
    WorkflowFiring,
    WorkflowSchedule,
    get_workflow_schedules,
    scheduled_workflow_handler_registry,
)

SCHEDULED_FOR = datetime(2024, 3, 10, 10, 0, tzinfo=UTC)


def enable(config: SeerWorkflowConfig) -> None:
    with SeerWorkflow(
        config_id=config.id, organization_id=config.organization_id
    ).update_config() as update:
        update.set_enabled(True)


def schedule_of(config: SeerWorkflowConfig) -> WorkflowSchedule | None:
    config.refresh_from_db()
    assert config.backing_workflow is not None
    return get_workflow_schedules([config.backing_workflow]).get(config.backing_workflow.id)


def test_trigger_key_is_the_scheduled_minute_in_utc() -> None:
    assert trigger_key_for(SCHEDULED_FOR) == "cron:2024-03-10T10:00"
    assert (
        trigger_key_for(SCHEDULED_FOR.astimezone(ZoneInfo("America/New_York")))
        == "cron:2024-03-10T10:00"
    )


class DispatchScheduledAutomationsTest(TestCase):
    def test_is_registered(self) -> None:
        assert (
            scheduled_workflow_handler_registry.get(Workflow.Type.SEER_INVESTIGATION)
            is dispatch_scheduled_automations
        )

    @patch("sentry.seer.workflows.scheduled.record_scheduled_automation_run.apply_async")
    def test_enqueues_a_task_per_scheduled_automation(self, mock_apply_async: MagicMock) -> None:
        scheduled = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION
        )
        metric = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )
        assert scheduled.backing_workflow_id is not None
        assert metric.backing_workflow_id is not None

        dispatch_scheduled_automations(
            [
                WorkflowFiring(
                    organization_id=self.organization.id,
                    workflow_id=workflow_id,
                    scheduled_for=SCHEDULED_FOR,
                )
                for workflow_id in (scheduled.backing_workflow_id, metric.backing_workflow_id)
            ]
        )

        mock_apply_async.assert_called_once_with(
            kwargs={
                "organization_id": self.organization.id,
                "config_id": scheduled.id,
                "scheduled_for": SCHEDULED_FOR.isoformat(),
            },
            headers={"sentry-propagate-traces": False},
        )


@with_feature(["organizations:seer-automations", SCHEDULED_EXECUTION_FEATURE])
class RecordScheduledAutomationRunTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION
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

    def is_scheduled(self) -> bool:
        return schedule_of(self.config) is not None

    def test_records_a_cron_run_that_completes(self) -> None:
        self.run_task()

        (run,) = self.runs()
        assert run.source == SeerWorkflowRunSource.CRON
        assert run.trigger_key == trigger_key_for(SCHEDULED_FOR)
        assert run.status == SeerWorkflowRunStatus.COMPLETE
        assert list(
            SeerWorkflowRunExecution.objects.filter(run=run).values_list("status", flat=True)
        ) == [SeerWorkflowExecutionStatus.COMPLETE]
        assert self.is_scheduled()

    def test_repeated_firing_records_one_run(self) -> None:
        self.run_task()
        self.run_task()

        assert len(self.runs()) == 1

    def test_execution_disabled_keeps_schedule_without_admitting_a_run(self) -> None:
        with self.feature({SCHEDULED_EXECUTION_FEATURE: False}):
            self.run_task()

        assert self.runs() == []
        assert self.is_scheduled()

    def test_feature_disabled_keeps_the_schedule(self) -> None:
        with self.feature({"organizations:seer-automations": False}):
            self.run_task()

        assert self.runs() == []
        assert self.is_scheduled()

    def test_disabled_config_records_nothing_and_keeps_its_schedule(self) -> None:
        Workflow.objects.filter(id=self.config.backing_workflow_id).update(enabled=False)

        self.run_task()

        assert self.runs() == []
        assert self.is_scheduled()

    def test_deleted_config_records_nothing(self) -> None:
        config_id = self.config.id
        self.config.delete()

        self.run_task(config_id)

        assert not SeerWorkflowRun.objects.filter(workflow_config_id=config_id).exists()

    def test_config_from_another_organization_is_ignored(self) -> None:
        other = Factories.create_seer_workflow_config(
            self.create_organization(), strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION
        )
        enable(other)

        self.run_task(other.id)

        assert not SeerWorkflowRun.objects.filter(workflow_config_id=other.id).exists()
        assert schedule_of(other) is not None


@with_feature("organizations:seer-automations")
class ScheduledAutomationEndToEndTest(TestCase):
    @patch("sentry.seer.workflows.scheduled.logger.info")
    def test_cadence_tick_reaches_disabled_execution_without_creating_history(
        self, mock_log: MagicMock
    ) -> None:
        with freeze_time(SCHEDULED_FOR - timedelta(hours=1)):
            config = Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION
            )
            enable(config)
        scheduled = schedule_of(config)
        assert scheduled is not None
        assert scheduled.next_run_at is not None
        assert SCHEDULED_FOR <= scheduled.next_run_at < SCHEDULED_FOR + timedelta(hours=1)

        with (
            freeze_time(scheduled.next_run_at),
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
        rescheduled = schedule_of(config)
        assert rescheduled is not None
        assert rescheduled.next_run_at == scheduled.next_run_at + timedelta(days=1)


class ScheduleDefinitionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION
        )
        self.workflow = SeerWorkflow(config_id=self.config.id, organization_id=self.organization.id)

    def test_new_automation_runs_daily(self) -> None:
        assert schedule_of(self.config) == WorkflowSchedule(
            cron=DEFAULT_CRON, timezone="UTC", next_run_at=None
        )

    def test_trigger_settings_replace_the_schedule(self) -> None:
        with self.workflow.update_config() as update:
            update.set_trigger_settings({"cron": "0 9 * * 1", "timezone": "America/New_York"})

        schedule = schedule_of(self.config)
        assert schedule is not None
        assert (schedule.cron, schedule.timezone) == ("0 9 * * 1", "America/New_York")
        assert self.config.version == 2

    def test_unchanged_trigger_settings_do_not_bump_the_version(self) -> None:
        with self.workflow.update_config() as update:
            update.set_trigger_settings({"cron": DEFAULT_CRON})

        self.config.refresh_from_db()
        assert self.config.version == 1

    def test_rejects_an_invalid_cron(self) -> None:
        with pytest.raises(WorkflowUpdateError), self.workflow.update_config() as update:
            update.set_trigger_settings({"cron": "not a cron"})

        assert schedule_of(self.config) == WorkflowSchedule(
            cron=DEFAULT_CRON, timezone="UTC", next_run_at=None
        )

    def test_enabling_gives_the_schedule_a_next_run(self) -> None:
        enable(self.config)

        schedule = schedule_of(self.config)
        assert schedule is not None
        assert schedule.next_run_at is not None

    def test_delete_clears_the_schedule(self) -> None:
        assert self.config.backing_workflow is not None
        backing_workflow = self.config.backing_workflow

        self.workflow.delete()

        assert get_workflow_schedules([backing_workflow]) == {}

    def test_metric_automation_takes_no_trigger_settings(self) -> None:
        metric = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )
        workflow = SeerWorkflow(config_id=metric.id, organization_id=self.organization.id)

        with pytest.raises(WorkflowUpdateError), workflow.update_config() as update:
            update.set_trigger_settings({"cron": "0 9 * * 1"})

        assert schedule_of(metric) is None
