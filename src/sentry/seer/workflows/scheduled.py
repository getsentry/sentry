"""
The scheduled automation: its trigger and action, and the sentry.cadence task that runs it.

Firings reach the task, but scheduled execution is separately gated off while Seer dispatch
is unimplemented. Admission and lifecycle handling remain available for that integration.
No run history is created while the execution flag is off.
"""

from __future__ import annotations

import functools
import logging
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, assert_never

from django.db.models import QuerySet
from pydantic import BaseModel, validator

from sentry import features
from sentry.cadence.api import (
    CronSchedule,
    Schedule,
    ScheduledTriggerType,
    TriggerFiring,
    TriggerHandler,
    TriggerTarget,
    clear_schedule,
    cron,
    missing_targets,
    register_trigger_type,
    set_schedule,
)
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowSchedule,
)
from sentry.seer.workflows.base import (
    AllProjects,
    AutomationAction,
    AutomationDefinition,
    AutomationTrigger,
    ConfigUpdate,
    ScopeSelection,
    SelectedMonitors,
    SelectedProjects,
    WorkflowUpdateError,
    lock_config,
    validate_project_ids,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SCHEDULED_EXECUTION_FEATURE = "organizations:seer-scheduled-automations"


class ScheduleSettings(BaseModel):
    # Cron expression in UTC. Unset runs on the config's ``schedule``.
    cron: str | None = None

    class Config:
        extra = "forbid"

    @validator("cron")
    def cron_is_valid(cls, value: str | None) -> str | None:
        if value is not None:
            cron(value)
        return value


class PromptSettings(BaseModel):
    prompt: str | None = None

    class Config:
        extra = "forbid"


class ScheduledRunInputs(BaseModel):
    """The inputs of a scheduled run, recorded in its snapshot."""

    source: Literal["cron"] = "cron"
    scheduled_for: datetime


@functools.cache
def _daily() -> CronSchedule:
    # Matches the legacy night shift's morning run. Firings are spread over the following
    # hour by the trigger type's spread window.
    return cron("0 10 * * *")


def schedule_for(config: SeerWorkflowConfig) -> Schedule | None:
    """The schedule a scheduled `config` should run on, or None while it is disabled."""
    if not config.enabled:
        return None
    extras = SeerWorkflowConfigExtras.parse_obj(config.extras)
    settings = ScheduleSettings.parse_obj(extras.trigger_settings or {})
    if settings.cron is not None:
        return cron(settings.cron)
    schedule = SeerWorkflowSchedule(config.schedule)
    match schedule:
        case SeerWorkflowSchedule.DAILY:
            return _daily()
        case _:
            assert_never(schedule)


def sync_schedule(config: SeerWorkflowConfig) -> None:
    """
    Make a scheduled config's cadence schedule match `schedule_for`. Safe to call
    repeatedly, so call it after any change to a config's `enabled` or `schedule`.
    """
    schedule = schedule_for(config)
    if schedule is None:
        clear_schedule(
            organization_id=config.organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_id=config.id,
        )
    else:
        set_schedule(
            organization_id=config.organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_id=config.id,
            schedule=schedule,
        )


class ScheduleTrigger(AutomationTrigger[ScheduledRunInputs]):
    """Runs on the config's schedule, over the projects the config selects."""

    inputs_type = ScheduledRunInputs
    settings_type = ScheduleSettings
    scoped_by: Literal["projects", "monitors"] = "projects"

    def projects(self, config: SeerWorkflowConfig) -> QuerySet[Project]:
        projects = Project.objects.filter(
            organization_id=config.organization_id, status=ObjectStatus.ACTIVE
        )
        if not SeerWorkflowFilters.parse_obj(config.filters).all_projects:
            projects = projects.filter(
                id__in=SeerWorkflowConfigProject.objects.filter(config=config).values("project_id")
            )
        return projects

    def set_scope(self, update: ConfigUpdate, selection: ScopeSelection) -> None:
        match selection:
            case AllProjects():
                all_projects = True
                project_ids: set[int] = set()
            case SelectedProjects(project_ids=selected):
                all_projects = False
                project_ids = set(selected)
            case SelectedMonitors():
                raise WorkflowUpdateError(
                    "This automation type does not support monitor selection."
                )
            case _:
                assert_never(selection)

        config = update.config
        validate_project_ids(config.organization_id, project_ids)

        links = SeerWorkflowConfigProject.objects.filter(config=config)
        existing = set(links.values_list("project_id", flat=True))
        removed = existing - project_ids
        added = project_ids - existing
        if removed or added:
            links.filter(project_id__in=removed).delete()
            SeerWorkflowConfigProject.objects.bulk_create(
                [
                    SeerWorkflowConfigProject(config=config, project_id=project_id)
                    for project_id in sorted(added)
                ]
            )
            update.mark_related_changed()

        filters = SeerWorkflowFilters.parse_obj(config.filters)
        if filters.all_projects != all_projects:
            filters.all_projects = all_projects
            config.filters = config.filters | filters.dict()
            update.mark("filters")

    def sync(self, config: SeerWorkflowConfig) -> None:
        sync_schedule(config)

    def teardown(self, config: SeerWorkflowConfig) -> None:
        clear_schedule(
            organization_id=config.organization_id,
            trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
            target_id=config.id,
        )


class PromptedInvestigationAction(AutomationAction[BaseModel]):
    """Run an investigation from a prompt, whatever started the run."""

    settings_type = PromptSettings

    def dispatch(
        self, config: SeerWorkflowConfig, run: SeerWorkflowRunLifecycle, inputs: BaseModel
    ) -> None:
        """Persist the execution plan and durable dispatch before admission commits.

        Seer result/status delivery must complete those executions. Raising here rolls back
        admission if the execution flag is enabled before this implementation is supplied.
        """
        raise NotImplementedError("Scheduled Seer automation dispatch is not implemented")


def trigger_key_for(scheduled_for: datetime) -> str:
    """Identifies a scheduled run, so the same run delivered twice is only created once."""
    return f"cron:{scheduled_for.astimezone(UTC):%Y-%m-%dT%H:%M}"


@register_trigger_type(ScheduledTriggerType.SEER_WORKFLOW)
class SeerWorkflowTriggerHandler(TriggerHandler):
    # Matches the legacy night shift's spread of org runs over the hour after its scheduled time.
    spread_window = timedelta(hours=1)

    def dispatch(self, firings: Sequence[TriggerFiring]) -> None:
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
    # Imported here because definitions imports this module for its table of pairings.
    from sentry.seer.workflows.definitions import find_definition

    config = SeerWorkflowConfig.objects.get_or_none(id=config_id, organization_id=organization_id)
    definition = find_definition(config.strategy) if config is not None else None
    if (
        config is None
        or definition is None
        or not isinstance(definition.trigger, ScheduleTrigger)
        or schedule_for(config) is None
    ):
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
    return _record_scheduled_run(definition, config.organization_id, config.id, scheduled_for)


def _record_scheduled_run(
    definition: AutomationDefinition[Any],
    organization_id: int,
    config_id: int,
    scheduled_for: datetime,
) -> ScheduledRunOutcome:
    """Admit and dispatch the run scheduled for `scheduled_for`, once per config."""
    try:
        with lock_config(organization_id, config_id) as config:
            if not config.enabled:
                return ScheduledRunOutcome("ignored", reason="config_disabled")

            run = definition.trigger_run(
                config,
                trigger_key=trigger_key_for(scheduled_for),
                inputs=ScheduledRunInputs(scheduled_for=scheduled_for),
            )
            if not run.created:
                return ScheduledRunOutcome("duplicate", run=run.lifecycle.get_run())
            if run.rejection is not None:
                return ScheduledRunOutcome(
                    "rejected", reason=run.rejection, run=run.lifecycle.get_run()
                )
            return ScheduledRunOutcome("accepted", run=run.lifecycle.get_run())
    except SeerWorkflowConfig.DoesNotExist:
        return ScheduledRunOutcome("ignored", reason="configuration_unavailable")
