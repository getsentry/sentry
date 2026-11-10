"""
Connects Seer automation schedules to sentry.cadence.

Firings reach the task, but scheduled execution is separately gated off while Seer dispatch
is unimplemented. Admission and lifecycle handling remain available for that integration.
No run history is created while the execution flag is off.
"""

from __future__ import annotations

import logging
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel

from sentry import features
from sentry.cadence.api import (
    ScheduledTriggerType,
    TriggerBehavior,
    TriggerFiring,
    TriggerTarget,
    clear_schedule,
    missing_targets,
    register_trigger_type,
)
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowRun,
    WorkflowRunError,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.seer.workflows.schedule import schedule_for
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SCHEDULED_EXECUTION_FEATURE = "organizations:seer-scheduled-automations"


class ScheduledRunInputs(BaseModel):
    """The inputs of a scheduled run, recorded in its snapshot."""

    source: Literal["cron"] = "cron"
    scheduled_for: datetime


def trigger_key_for(scheduled_for: datetime) -> str:
    """Identifies a scheduled run, so the same run delivered twice is only created once."""
    return f"cron:{scheduled_for.astimezone(UTC):%Y-%m-%dT%H:%M}"


@register_trigger_type(ScheduledTriggerType.SEER_WORKFLOW)
class SeerWorkflowTrigger(TriggerBehavior):
    # Matches the legacy night shift's spread of org runs over the hour after its scheduled time.
    spread_window = timedelta(hours=1)

    def hand_off(self, firings: Sequence[TriggerFiring]) -> None:
        for firing in firings:
            record_scheduled_automation_run.apply_async(
                kwargs={
                    "organization_id": firing.organization_id,
                    "config_id": firing.target_id,
                    "scheduled_for": firing.scheduled_for.isoformat(),
                },
                headers={"sentry-propagate-traces": False},
            )

    def find_missing(self, targets: Sequence[TriggerTarget]) -> Collection[TriggerTarget]:
        return missing_targets(SeerWorkflowConfig, targets)


@dataclass(frozen=True)
class ScheduledRunOutcome:
    outcome: Literal["accepted", "duplicate", "rejected", "ignored"]
    reason: str | None = None
    run: SeerWorkflowRun | None = None


@instrumented_task(
    name="sentry.seer.workflows.scheduled.record_scheduled_automation_run",
    namespace=seer_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
)
def record_scheduled_automation_run(
    organization_id: int, config_id: int, scheduled_for: str, **kwargs: Any
) -> None:
    """Record the cron-sourced run of an automation config that Cadence says is due."""
    result = _run(organization_id, config_id, datetime.fromisoformat(scheduled_for))
    metrics.incr(
        "seer.workflow.scheduled_run",
        tags={"outcome": result.outcome, "reason": result.reason or "none"},
        sample_rate=1.0,
    )
    logger.info(
        "seer.workflow.scheduled_run",
        extra={
            "organization_id": organization_id,
            "config_id": config_id,
            "scheduled_for": scheduled_for,
            "outcome": result.outcome,
            "reason": result.reason,
            "run_id": result.run.id if result.run else None,
        },
    )


def _run(organization_id: int, config_id: int, scheduled_for: datetime) -> ScheduledRunOutcome:
    config = SeerWorkflowConfig.objects.get_or_none(id=config_id, organization_id=organization_id)
    if config is None or schedule_for(config) is None:
        # The config was deleted, disabled, or no longer runs on a schedule, but its
        # schedule wasn't cleared. Clear it now so it stops firing.
        clear_schedule(
            organization_id=organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_id=config_id,
        )
        return ScheduledRunOutcome("ignored", reason="unscheduled")
    # Entitlement can come back, so keep the schedule and do nothing this time.
    if not features.has("organizations:seer-automations", config.organization):
        return ScheduledRunOutcome("ignored", reason="feature_disabled")
    # Scheduling and stale-registration cleanup stay active while execution is disabled.
    # Firings consumed during this stage are not replayed when execution is enabled later.
    if not features.has(SCHEDULED_EXECUTION_FEATURE, config.organization):
        return ScheduledRunOutcome("ignored", reason="execution_disabled")
    return ScheduledSeerWorkflow(
        config_id=config.id, organization_id=config.organization_id
    ).record_run(scheduled_for)


class ScheduledSeerWorkflow(SeerWorkflow):
    def record_run(self, scheduled_for: datetime) -> ScheduledRunOutcome:
        """Admit and dispatch the run scheduled for `scheduled_for`, once per config."""
        try:
            with self._lock_config() as config:
                if not config.enabled:
                    return ScheduledRunOutcome("ignored", reason="configuration_unavailable")

                result = self.get_or_create_run(
                    trigger_key=trigger_key_for(scheduled_for),
                    inputs=ScheduledRunInputs(scheduled_for=scheduled_for),
                )
                lifecycle = result.lifecycle
                if not result.created:
                    return ScheduledRunOutcome("duplicate", run=lifecycle.get_run())
                if not self.has_quota_available():
                    run = lifecycle.reject(
                        error=WorkflowRunError(
                            code="quota_exceeded", message="Automation quota exceeded."
                        )
                    )
                    return ScheduledRunOutcome("rejected", reason="quota_exceeded", run=run)

                lifecycle.start()
                self._dispatch_run(lifecycle)
                return ScheduledRunOutcome("accepted", run=lifecycle.get_run())
        except SeerWorkflowConfig.DoesNotExist:
            return ScheduledRunOutcome("ignored", reason="configuration_unavailable")

    def _dispatch_run(self, lifecycle: SeerWorkflowRunLifecycle) -> None:
        """Persist the strategy's execution plan and durable dispatch before admission commits.

        Seer result/status delivery must complete those executions. Raising here rolls back
        admission if the execution flag is enabled before this implementation is supplied.
        """
        raise NotImplementedError("Scheduled Seer automation dispatch is not implemented")
