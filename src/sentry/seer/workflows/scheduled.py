"""
Records runs of Seer automations on their configs' schedules, using sentry.cadence.

Scheduling only: runs are recorded but no work is sent to Seer yet. See the placeholder in
ScheduledSeerWorkflow.record_run.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel

from sentry import features
from sentry.cadence.api import (
    ScheduledTriggerType,
    TriggerFiring,
    clear_schedule,
    register_trigger_action,
)
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionExtras,
    SeerWorkflowRun,
    WorkflowRunError,
)
from sentry.seer.workflows.schedule import schedule_for
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class ScheduledRunInputs(BaseModel):
    """The inputs of a scheduled run, recorded in its snapshot."""

    source: Literal["cron"] = "cron"
    scheduled_for: datetime


def trigger_key_for(scheduled_for: datetime) -> str:
    """Identifies a scheduled run, so the same run delivered twice is only created once."""
    return f"cron:{scheduled_for.astimezone(UTC):%Y-%m-%dT%H:%M}"


# Matches the legacy night shift's spread of org runs over the hour after its scheduled time.
@register_trigger_action(ScheduledTriggerType.SEER_WORKFLOW, spread_window=timedelta(hours=1))
def enqueue_scheduled_automation_runs(firings: Sequence[TriggerFiring]) -> None:
    for firing in firings:
        record_scheduled_automation_run.apply_async(
            kwargs={
                "organization_id": firing.organization_id,
                "config_id": firing.target_id,
                "scheduled_for": firing.scheduled_for.isoformat(),
            },
            headers={"sentry-propagate-traces": False},
        )


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
    return ScheduledSeerWorkflow(
        config_id=config.id, organization_id=config.organization_id
    ).record_run(scheduled_for)


class ScheduledSeerWorkflow(SeerWorkflow):
    def record_run(self, scheduled_for: datetime) -> ScheduledRunOutcome:
        """Record the run scheduled for `scheduled_for`, once per config."""
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
                # TODO: PLACEHOLDER, NOT SEER INTEGRATION. Nothing is sent to Seer: this
                # records one empty execution and completes the run immediately, so every
                # scheduled run reports COMPLETE without doing any work. Replace it with the
                # strategy's planning and dispatch (select candidates, one execution per
                # batch, start_feature_run per execution), and complete executions when
                # Seer delivers their results rather than here.
                (execution,) = lifecycle.create_executions([SeerWorkflowExecutionExtras()])
                lifecycle.start_execution(execution.id)
                lifecycle.complete_execution(execution.id)
                return ScheduledRunOutcome("accepted", run=lifecycle.get_run())
        except SeerWorkflowConfig.DoesNotExist:
            return ScheduledRunOutcome("ignored", reason="configuration_unavailable")
