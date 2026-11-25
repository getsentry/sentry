"""
The scheduled automation: its trigger and action, and the task that runs each firing of its
backing workflow's schedule.

Each firing records one run per scheduled time. Until the investigation platform runs
custom prompts, a run's single execution succeeds immediately. No run history is created
while the execution flag is off.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, ClassVar, Literal, assert_never

from django.db.models import QuerySet
from pydantic import BaseModel, ValidationError

from sentry import features
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerSkill,
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowExecutionExtras,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunSource,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.base import (
    AllProjects,
    AutomationDefinition,
    ConfigUpdate,
    LockedConfig,
    NoSettings,
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
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.schedules import (
    InvalidWorkflowSchedule,
    WorkflowFiring,
    clear_workflow_schedule,
    scheduled_workflow_handler_registry,
    set_workflow_schedule,
)

logger = logging.getLogger(__name__)

SCHEDULED_EXECUTION_FEATURE = "organizations:seer-scheduled-automations"


# Matches the legacy night shift's morning run. Firings are spread over the following hour.
DEFAULT_CRON = "0 10 * * *"


class ScheduleSettings(BaseModel):
    cron: str
    timezone: str = "UTC"

    class Config:
        extra = "forbid"


class ScheduledRunInputs(BaseModel):
    """The inputs of a scheduled run, recorded in its snapshot."""

    source: Literal["cron"] = "cron"
    scheduled_for: datetime


class ScheduleDefinition(AutomationDefinition[ScheduledRunInputs]):
    """Runs on the config's schedule, over the projects the config selects."""

    strategy = SeerWorkflowStrategy.SCHEDULED_INVESTIGATION
    inputs_type = ScheduledRunInputs
    settings_type = NoSettings
    takes_action_settings = True
    seeded_action_settings: ClassVar[Mapping[str, Any]] = {"skill": SeerSkill.AGENTIC_TRIAGE.value}
    scoped_by: Literal["projects", "monitors"] = "projects"

    def setup(self, update: ConfigUpdate, workflow: Workflow) -> None:
        action = Action.objects.create(type=Action.Type.SEER_INVESTIGATION, config={}, data={})
        action_group = DataConditionGroup.objects.create(
            organization_id=update.config.organization_id, logic_type=DataConditionGroup.Type.ALL
        )
        WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=action_group)
        DataConditionGroupAction.objects.create(condition_group=action_group, action=action)
        set_workflow_schedule(workflow, cron=DEFAULT_CRON)

    def set_trigger_settings(
        self, update: ConfigUpdate, workflow: Workflow, trigger_settings: Mapping[str, Any]
    ) -> None:
        try:
            settings = ScheduleSettings.parse_obj(trigger_settings)
            changed = set_workflow_schedule(
                workflow, cron=settings.cron, timezone=settings.timezone
            )
        except (ValidationError, InvalidWorkflowSchedule) as e:
            raise WorkflowUpdateError(str(e)) from e
        if changed:
            update.mark_related_changed()

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

    def teardown(self, config: SeerWorkflowConfig) -> None:
        if config.backing_workflow is not None:
            clear_workflow_schedule(config.backing_workflow)

    def admit_firing(self, config: LockedConfig, scheduled_for: datetime) -> ScheduledRunOutcome:
        """Record one run per scheduled time, and dispatch it when it is new."""
        if not self.is_enabled(config):
            return ScheduledRunOutcome("ignored", reason="config_disabled")
        admitted = self.admit_run(
            config,
            trigger_key=trigger_key_for(scheduled_for),
            source=SeerWorkflowRunSource.CRON,
            inputs=ScheduledRunInputs(scheduled_for=scheduled_for),
        )
        if admitted.rejection is not None:
            return ScheduledRunOutcome(
                "rejected", reason=admitted.rejection, run=admitted.lifecycle.get_run()
            )
        if not admitted.created:
            return ScheduledRunOutcome("duplicate", run=admitted.lifecycle.get_run())
        admitted.lifecycle.start()
        self.dispatch(admitted.lifecycle)
        return ScheduledRunOutcome("accepted", run=admitted.lifecycle.get_run())

    def dispatch(self, run: SeerWorkflowRunLifecycle) -> None:
        # TODO(telkins): Start an investigation with the config's prompt or skill once the
        # investigation platform runs custom prompts. Until then the run has one execution
        # that succeeds immediately.
        (execution,) = run.create_executions([SeerWorkflowExecutionExtras()])
        run.start_execution(execution.id)
        run.complete_execution(execution.id)


def trigger_key_for(scheduled_for: datetime) -> str:
    """Identifies a scheduled run, so the same run delivered twice is only created once."""
    return f"cron:{scheduled_for.astimezone(UTC):%Y-%m-%dT%H:%M}"


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
    if (
        config is None
        or config.strategy != ScheduleDefinition.strategy
        or not AutomationDefinition.is_enabled(config)
    ):
        return ScheduledRunOutcome("ignored", reason="unscheduled")
    # Entitlement can come back, so keep the schedule and do nothing this time.
    if not features.has("organizations:seer-automations", config.organization):
        return ScheduledRunOutcome("ignored", reason="feature_disabled")
    # Scheduling stays active while execution is disabled.
    # Firings consumed during this stage are not replayed when execution is enabled later.
    if not features.has(SCHEDULED_EXECUTION_FEATURE, config.organization):
        return ScheduledRunOutcome("ignored", reason="execution_disabled")
    try:
        with lock_config(organization_id, config_id) as locked:
            return ScheduleDefinition().admit_firing(locked, scheduled_for)
    except SeerWorkflowConfig.DoesNotExist:
        return ScheduledRunOutcome("ignored", reason="unscheduled")


@scheduled_workflow_handler_registry.register(Workflow.Type.SEER_INVESTIGATION)
def dispatch_scheduled_automations(firings: Sequence[WorkflowFiring]) -> None:
    config_ids = dict(
        SeerWorkflowConfig.objects.filter(
            backing_workflow_id__in={firing.workflow_id for firing in firings},
            strategy=ScheduleDefinition.strategy,
        ).values_list("backing_workflow_id", "id")
    )
    for firing in firings:
        config_id = config_ids.get(firing.workflow_id)
        if config_id is None:
            continue
        record_scheduled_automation_run.apply_async(
            kwargs={
                "organization_id": firing.organization_id,
                "config_id": config_id,
                "scheduled_for": firing.scheduled_for.isoformat(),
            },
            headers={"sentry-propagate-traces": False},
        )
