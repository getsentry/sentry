"""
Schedules for workflows that run on a clock.

A workflow's schedule is stored in sentry.cadence, keyed by the workflow's id, and nowhere
else. Code outside workflow engine sets, reads and clears it here, and registers what a
firing does with `scheduled_workflow_handler_registry`, so it never talks to cadence.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Collection, Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from sentry.cadence.api import (
    CronSchedule,
    InvalidSchedule,
    ScheduledTriggerType,
    TriggerFiring,
    TriggerHandler,
    TriggerTarget,
    clear_schedule,
    get_schedules,
    missing_targets,
    register_trigger_type,
    set_schedule,
)
from sentry.constants import ObjectStatus
from sentry.utils.registry import Registry
from sentry.workflow_engine.models import Workflow


class InvalidWorkflowSchedule(ValueError):
    pass


@dataclass(frozen=True)
class WorkflowSchedule:
    cron: str
    timezone: str
    # None while the workflow is disabled: its schedule is kept, but its firings are dropped.
    next_run_at: datetime | None


@dataclass(frozen=True)
class WorkflowFiring:
    organization_id: int
    workflow_id: int
    # Stable across duplicate deliveries of the same firing, so it can be used to deduplicate.
    scheduled_for: datetime


type ScheduledWorkflowHandler = Callable[[Sequence[WorkflowFiring]], None]

# What a firing does, by Workflow.Type. A handler gets a batch of firings and must be cheap,
# such as scheduling a task per firing: it runs inline in the cadence tick.
scheduled_workflow_handler_registry = Registry[ScheduledWorkflowHandler](
    enable_reverse_lookup=False
)


def set_workflow_schedule(workflow: Workflow, *, cron: str, timezone: str = "UTC") -> bool:
    """
    Run `workflow` on a five-field `cron` expression evaluated in `timezone`, replacing any
    schedule it has. Returns whether the schedule changed.

    Raises InvalidWorkflowSchedule for a bad expression or timezone, and
    NoRegistrationExistsError if the workflow's type has no scheduled handler.
    """
    scheduled_workflow_handler_registry.get(workflow.type)
    try:
        schedule = CronSchedule(cron, timezone)
    except InvalidSchedule as e:
        raise InvalidWorkflowSchedule(str(e)) from e
    current = get_schedules(
        organization_id=workflow.organization_id,
        trigger_type=ScheduledTriggerType.WORKFLOW,
        target_ids=[workflow.id],
    ).get(workflow.id)
    if current is not None and current.schedule == schedule:
        return False
    set_schedule(
        organization_id=workflow.organization_id,
        trigger_type=ScheduledTriggerType.WORKFLOW,
        target_id=workflow.id,
        schedule=schedule,
    )
    return True


def clear_workflow_schedule(workflow: Workflow) -> None:
    clear_schedule(
        organization_id=workflow.organization_id,
        trigger_type=ScheduledTriggerType.WORKFLOW,
        target_id=workflow.id,
    )


def get_workflow_schedules(workflows: Iterable[Workflow]) -> dict[int, WorkflowSchedule]:
    """The schedules of those `workflows` that have one, keyed by workflow id."""
    by_organization: defaultdict[int, dict[int, Workflow]] = defaultdict(dict)
    for workflow in workflows:
        by_organization[workflow.organization_id][workflow.id] = workflow
    schedules: dict[int, WorkflowSchedule] = {}
    for organization_id, organization_workflows in by_organization.items():
        infos = get_schedules(
            organization_id=organization_id,
            trigger_type=ScheduledTriggerType.WORKFLOW,
            target_ids=organization_workflows,
        )
        for workflow_id, info in infos.items():
            if not isinstance(info.schedule, CronSchedule):
                continue
            schedules[workflow_id] = WorkflowSchedule(
                cron=info.schedule.expression,
                timezone=info.schedule.timezone,
                next_run_at=(
                    info.next_fire_at if _is_running(organization_workflows[workflow_id]) else None
                ),
            )
    return schedules


def _is_running(workflow: Workflow) -> bool:
    return workflow.enabled and workflow.status == ObjectStatus.ACTIVE


@register_trigger_type(ScheduledTriggerType.WORKFLOW)
class WorkflowTriggerHandler(TriggerHandler):
    spread_window = timedelta(hours=1)

    def dispatch(self, firings: Sequence[TriggerFiring]) -> None:
        workflow_types = {
            (organization_id, workflow_id): workflow_type
            for organization_id, workflow_id, workflow_type in Workflow.objects.filter(
                id__in={firing.target_id for firing in firings},
                enabled=True,
                status=ObjectStatus.ACTIVE,
            ).values_list("organization_id", "id", "type")
        }
        by_type: defaultdict[str, list[WorkflowFiring]] = defaultdict(list)
        for firing in firings:
            workflow_type = workflow_types.get((firing.organization_id, firing.target_id))
            if workflow_type is not None:
                by_type[workflow_type].append(
                    WorkflowFiring(
                        organization_id=firing.organization_id,
                        workflow_id=firing.target_id,
                        scheduled_for=firing.scheduled_for,
                    )
                )
        for workflow_type, workflow_firings in by_type.items():
            scheduled_workflow_handler_registry.get(workflow_type)(workflow_firings)

    def find_missing(self, targets: Sequence[TriggerTarget]) -> Collection[TriggerTarget]:
        return missing_targets(Workflow, targets)


@register_trigger_type(ScheduledTriggerType.SEER_WORKFLOW)
class LegacySeerWorkflowTriggerHandler(TriggerHandler):
    """Triggers written before schedules were keyed by workflow. They no longer fire."""

    def dispatch(self, firings: Sequence[TriggerFiring]) -> None:
        pass

    def find_missing(self, targets: Sequence[TriggerTarget]) -> Collection[TriggerTarget]:
        return []
