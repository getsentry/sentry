from __future__ import annotations

import functools
from datetime import datetime
from typing import Any, Literal, assert_never
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import QuerySet
from pydantic import BaseModel, validator

from sentry.cadence.api import (
    CronSchedule,
    Schedule,
    ScheduledTriggerType,
    clear_schedule,
    cron,
    set_schedule,
)
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowSchedule,
)
from sentry.seer.workflows.base import (
    AllProjects,
    ConfigUpdate,
    ScopeSelection,
    SelectedMonitors,
    SelectedProjects,
    WorkflowAction,
    WorkflowTrigger,
    WorkflowUpdateError,
    validate_project_ids,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle


class ScheduleSettings(BaseModel):
    # IANA timezone name, e.g. "America/New_York".
    timezone: str = "UTC"
    # Cron expression evaluated in ``timezone``. Unset runs on the config's ``schedule``.
    cron: str | None = None

    class Config:
        extra = "forbid"

    @validator("cron")
    def cron_is_valid(cls, value: str | None, values: dict[str, Any]) -> str | None:
        if value is not None and "timezone" in values:
            cron(value, values["timezone"])
        return value

    @validator("timezone")
    def timezone_is_valid(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(f"Unknown timezone: {value}")
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
    # hour by the trigger type's spread window; see sentry.seer.workflows.scheduled.
    return cron("0 10 * * *")


def schedule_for(config: SeerWorkflowConfig) -> Schedule | None:
    """The schedule a scheduled `config` should run on, or None while it is disabled."""
    if not config.enabled:
        return None
    extras = SeerWorkflowConfigExtras.parse_obj(config.extras)
    settings = ScheduleSettings.parse_obj(extras.trigger_settings or {})
    if settings.cron is not None:
        return cron(settings.cron, settings.timezone)
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


class ScheduleTrigger(WorkflowTrigger[ScheduledRunInputs]):
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
                raise WorkflowUpdateError("Only metric automations support monitor selection.")
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


class PromptedInvestigationAction(WorkflowAction[BaseModel]):
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
