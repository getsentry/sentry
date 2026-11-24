from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, call, patch
from zoneinfo import ZoneInfo

import pytest
from django.db import router, transaction

from sentry.cadence.api import (
    ScheduledTriggerType,
    TriggerFiring,
    TriggerTarget,
    cron,
    get_schedules,
)
from sentry.cadence.registry import trigger_type_registry
from sentry.cadence.tasks import cadence_tick
from sentry.locks import locks
from sentry.notifications.models.notificationthread import (
    NotificationThread,
    NotificationThreadObjectType,
)
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunSource,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.scheduled import (
    SCHEDULED_EXECUTION_FEATURE,
    SeerWorkflowTriggerHandler,
    record_scheduled_automation_run,
    schedule_for,
    sync_schedule,
    trigger_key_for,
)
from sentry.seer.workflows.slack import RetrySlackAnnouncement, announce_workflow_run
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.models import Workflow

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

    def is_scheduled(self, config_id: int | None = None) -> bool:
        config_id = config_id or self.config.id
        return config_id in get_schedules(
            organization_id=self.organization.id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_ids=[config_id],
        )

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

    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.send_notification",
        return_value={"ts": "10.1"},
    )
    def test_completed_run_announces_once_in_original_channel(self, send: MagicMock) -> None:
        integration = self.create_integration(
            self.organization, provider="slack", external_id="T123"
        )
        destination = {
            "integration_id": integration.id,
            "channel_id": "C123",
            "channel_name": "ops",
        }
        self.config.update(extras={"slack_destination": destination})
        with (
            patch.object(announce_workflow_run, "delay") as enqueue,
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.run_task()
            self.run_task()
        (run,) = self.runs()
        enqueue.assert_called_once_with(organization_id=self.organization.id, run_id=run.id)
        self.config.update(extras={})
        announce_workflow_run(organization_id=self.organization.id, run_id=run.id)
        announce_workflow_run(organization_id=self.organization.id, run_id=run.id)
        send.assert_called_once()
        target, message = send.call_args.args
        assert target.resource_id == "C123"
        assert message["text"] == "Seer automation started a run"
        runs_link = message["blocks"][-1].elements[0].url
        assert runs_link.endswith(f"/seer/automations/{self.config.id}/runs/")
        parent = NotificationThread.objects.get(
            object_type=NotificationThreadObjectType.SEER_WORKFLOW_RUN, object_id=run.id
        )
        assert parent.thread_identifier == "10.1"
        assert run.status == SeerWorkflowRunStatus.COMPLETE

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_notification")
    def test_announcer_skips_busy_or_unavailable_destination(self, send: MagicMock) -> None:
        integration = self.create_integration(
            self.organization, provider="slack", external_id="T123"
        )
        self.config.update(
            extras={
                "slack_destination": {
                    "integration_id": integration.id,
                    "channel_id": "C123",
                    "channel_name": "ops",
                }
            }
        )
        with patch.object(announce_workflow_run, "delay"):
            self.run_task()
        (run,) = self.runs()
        with (
            locks.get(
                f"seer:workflow:slack:{run.id}", duration=60, name="seer_workflow_slack"
            ).acquire(),
            pytest.raises(UnableToAcquireLock),
        ):
            announce_workflow_run(organization_id=self.organization.id, run_id=run.id)
        with patch(
            "sentry.seer.workflows.slack.integration_service.organization_context"
        ) as context:
            context.return_value.active.return_value = None
            announce_workflow_run(organization_id=self.organization.id, run_id=run.id)
        send.assert_not_called()
        send.side_effect = IntegrationConfigurationError(message="ratelimited", error_code=429)
        with pytest.raises(RetrySlackAnnouncement):
            announce_workflow_run(organization_id=self.organization.id, run_id=run.id)
        send.side_effect = IntegrationConfigurationError(message="channel_not_found")
        announce_workflow_run(organization_id=self.organization.id, run_id=run.id)
        run.refresh_from_db()
        assert run.status == SeerWorkflowRunStatus.COMPLETE
        assert not NotificationThread.objects.filter(
            object_type=NotificationThreadObjectType.SEER_WORKFLOW_RUN, object_id=run.id
        ).exists()

    def test_start_rollback_does_not_announce(self) -> None:
        self.config.update(
            extras={
                "slack_destination": {
                    "integration_id": 123,
                    "channel_id": "C123",
                    "channel_name": "ops",
                }
            }
        )
        with (
            patch.object(announce_workflow_run, "delay") as enqueue,
            self.captureOnCommitCallbacks(execute=True),
        ):
            db = router.db_for_write(SeerWorkflowRun)
            with transaction.atomic(using=db):
                self.run_task()
                transaction.set_rollback(True, using=db)
        enqueue.assert_not_called()
        assert self.runs() == []

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

    def test_disabled_config_clears_its_stale_schedule(self) -> None:
        # Disabled without going through update_config, so the schedule was left behind.
        assert self.config.backing_workflow is not None
        Workflow.objects.filter(id=self.config.backing_workflow_id).update(enabled=False)

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
            self.create_organization(), strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION
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
                self.organization, strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION
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
            self.organization, strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION, enabled=True
        )
        assert schedule_for(config) == cron("0 10 * * *")

    def test_config_cron_overrides_the_daily_schedule(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION,
            enabled=True,
            extras={"trigger_settings": {"cron": "0 9 * * 1"}},
        )
        assert schedule_for(config) == cron("0 9 * * 1")

    def test_disabled_config_is_unscheduled(self) -> None:
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION, enabled=False
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
            self.organization, strategy=SeerWorkflowStrategy.SCHEDULED_INVESTIGATION, enabled=True
        )

        sync_schedule(config)
        assert self.next_run(config) == datetime(2024, 3, 10, 10, 0, tzinfo=UTC)

        assert config.backing_workflow is not None
        config.backing_workflow.enabled = False
        sync_schedule(config)
        assert self.next_run(config) is None
