from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated, Any, Literal, NewType, Protocol

from django.db import router, transaction
from django.db.models import QuerySet
from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError

from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunExtras,
    SeerWorkflowStrategy,
    WorkflowRunError,
    WorkflowRunSnapshot,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.utils import json


class WorkflowUpdateError(ValueError):
    """A rejected workflow update whose message is safe to show users."""


@dataclass(frozen=True)
class AllProjects:
    pass


@dataclass(frozen=True)
class SelectedProjects:
    project_ids: tuple[int, ...]


@dataclass(frozen=True)
class SelectedMonitors:
    monitor_ids: tuple[int, ...]


type ProjectSelection = AllProjects | SelectedProjects
type ScopeSelection = ProjectSelection | SelectedMonitors


def validate_project_ids(organization_id: int, project_ids: set[int]) -> None:
    valid_project_ids = set(
        Project.objects.filter(organization_id=organization_id, id__in=project_ids).values_list(
            "id", flat=True
        )
    )
    if project_ids != valid_project_ids:
        raise WorkflowUpdateError("Selected projects must exist in the workflow's organization")


# A config row read with ``select_for_update`` inside the current transaction.
LockedConfig = NewType("LockedConfig", SeerWorkflowConfig)


@contextmanager
def lock_config(organization_id: int, config_id: int) -> Iterator[LockedConfig]:
    """Hold the config's row lock for the block. Raises DoesNotExist for a missing config."""
    database = router.db_for_write(SeerWorkflowConfig)
    with transaction.atomic(database):
        yield LockedConfig(
            SeerWorkflowConfig.objects.using(database)
            .select_for_update()
            .get(id=config_id, organization_id=organization_id)
        )


class NoSettings(BaseModel):
    class Config:
        extra = "forbid"


class AutomationTrigger[Inputs: BaseModel](Protocol):
    """How an automation's runs start, and which projects those runs cover."""

    # What a firing hands to the automation's action; recorded in the run's snapshot.
    inputs_type: type[Inputs]
    settings_type: type[BaseModel]
    scoped_by: Literal["projects", "monitors"]

    def projects(self, config: SeerWorkflowConfig) -> QuerySet[Project]:
        """Return the active projects in the config's scope."""
        ...

    def set_scope(self, update: ConfigUpdate, selection: ScopeSelection) -> None:
        """Replace the config's scope, marking ``update`` only when something changed."""
        ...

    def sync(self, config: SeerWorkflowConfig) -> None:
        """Bring anything the trigger keeps outside the config in line with it."""
        ...

    def teardown(self, config: SeerWorkflowConfig) -> None:
        """Remove anything the trigger keeps outside the config, before it is deleted."""
        ...


class AutomationAction[Inputs: BaseModel](Protocol):
    """What Seer does for an admitted run."""

    settings_type: type[BaseModel]

    def dispatch(
        self, config: SeerWorkflowConfig, run: SeerWorkflowRunLifecycle, inputs: Inputs
    ) -> None:
        """Persist the run's execution plan and start its work.

        Called once per run, inside the transaction that admitted it. Raising rolls the
        admission back so a redelivered trigger can retry.
        """
        ...


RejectionReason = Literal["quota_exceeded"]


class AcceptedAdmission(BaseModel):
    status: Literal["accepted"] = "accepted"
    reason: None = None
    decided_at: datetime


class RejectedAdmission(BaseModel):
    status: Literal["rejected"] = "rejected"
    reason: RejectionReason
    decided_at: datetime


RunAdmission = Annotated[AcceptedAdmission | RejectedAdmission, Field(discriminator="status")]


class AdmittedRunExtras(SeerWorkflowRunExtras):
    admission: RunAdmission


@dataclass(frozen=True)
class AdmittedRun:
    lifecycle: SeerWorkflowRunLifecycle
    # False when the trigger key already had a run, which keeps its original decision.
    created: bool
    rejection: RejectionReason | None = None


@dataclass(frozen=True)
class AutomationDefinition[Inputs: BaseModel]:
    """An automation: a trigger paired with an action that accepts what it produces."""

    trigger: AutomationTrigger[Inputs]
    action: AutomationAction[Inputs]

    def project_ids(self, config: SeerWorkflowConfig) -> list[int]:
        return list(self.trigger.projects(config).order_by("id").values_list("id", flat=True))

    def covers(self, config: SeerWorkflowConfig, project_id: int, environment: str | None) -> bool:
        filters = SeerWorkflowFilters.parse_obj(config.filters)
        return (
            config.enabled
            and (not filters.environments or environment in filters.environments)
            and self.trigger.projects(config).filter(id=project_id).exists()
        )

    def validate_settings(self, extras: SeerWorkflowConfigExtras) -> tuple[BaseModel, BaseModel]:
        """Return the parsed trigger and action settings."""
        try:
            return (
                self.trigger.settings_type.parse_obj(extras.trigger_settings or {}),
                self.action.settings_type.parse_obj(extras.action_settings or {}),
            )
        except ValidationError as e:
            raise WorkflowUpdateError(
                "; ".join(
                    f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                    for error in e.errors()
                )
            ) from e

    def has_quota_available(self, config: SeerWorkflowConfig) -> bool:
        """Allow runs until automation quota enforcement is implemented."""
        # TODO(telkins): Enforce automation quota before accepting a new run.
        return True

    def admit_run(self, config: LockedConfig, *, trigger_key: str, inputs: Inputs) -> AdmittedRun:
        """Record one admission decision per trigger key, leaving an accepted run queued.

        Retries return the original run with its configuration, inputs and decision.
        """
        if not trigger_key or len(trigger_key) > 256:
            raise ValueError("Trigger keys must contain between 1 and 256 characters")

        runs = SeerWorkflowRun.objects.using(router.db_for_write(SeerWorkflowRun))
        existing = (
            runs.filter(
                organization_id=config.organization_id,
                workflow_config_id=config.id,
                trigger_key=trigger_key,
            )
            .order_by("-date_added", "-id")
            .first()
        )
        if existing is not None:
            lifecycle = SeerWorkflowRunLifecycle(
                run_id=existing.id, organization_id=existing.organization_id
            )
            return AdmittedRun(
                lifecycle=lifecycle,
                created=False,
                rejection=lifecycle.parse_extras(AdmittedRunExtras).admission.reason,
            )

        decided_at = timezone.now()
        admission: AcceptedAdmission | RejectedAdmission = (
            AcceptedAdmission(decided_at=decided_at)
            if self.has_quota_available(config)
            else RejectedAdmission(reason="quota_exceeded", decided_at=decided_at)
        )
        extras = AdmittedRunExtras(
            snapshot=WorkflowRunSnapshot(
                config_version=config.version,
                strategy=SeerWorkflowStrategy(config.strategy),
                filters=config.filters,
                project_ids=tuple(self.project_ids(config)),
                output_policy=config.output_policy,
                inputs=json.loads(inputs.json()),
            ),
            admission=admission,
        )
        lifecycle = SeerWorkflowRunLifecycle.create(config, trigger_key=trigger_key, extras=extras)
        # TODO(telkins): Decide whether an automation that stays over quota should keep
        # recording a rejected run for every trigger.
        if admission.status == "rejected":
            lifecycle.reject(
                error=WorkflowRunError(code=admission.reason, message="Automation quota exceeded.")
            )
            return AdmittedRun(lifecycle=lifecycle, created=True, rejection=admission.reason)
        return AdmittedRun(lifecycle=lifecycle, created=True)

    def trigger_run(self, config: LockedConfig, *, trigger_key: str, inputs: Inputs) -> AdmittedRun:
        """Admit a triggered run and, the first time it is accepted, dispatch the action."""
        run = self.admit_run(config, trigger_key=trigger_key, inputs=inputs)
        if run.created and run.rejection is None:
            run.lifecycle.start()
            self.action.dispatch(config, run.lifecycle, inputs)
        return run


@dataclass
class ConfigUpdate:
    """Pending changes to a locked config row.

    Only create one through ``SeerWorkflow``. Setters should mutate ``config`` then mark
    what they changed after their last step that can fail.
    """

    # Config DB row to update. DO NOT call save() on this directly - use ``update_config``
    config: LockedConfig
    definition: AutomationDefinition[Any]
    dirty_fields: set[str] = field(default_factory=set)
    related_changed: bool = False

    @property
    def changed(self) -> bool:
        return bool(self.dirty_fields) or self.related_changed

    def mark(self, *fields: str) -> None:
        """Record changed columns on the config row."""
        self.dirty_fields.update(fields)

    def mark_related_changed(self) -> None:
        """Record changes outside the row, like project links, that still bump the version."""
        self.related_changed = True

    def set_enabled(self, enabled: bool) -> None:
        if self.config.enabled == enabled:
            return
        self.config.enabled = enabled
        self.mark("enabled")

    def set_extras(self, extras: SeerWorkflowConfigExtras) -> None:
        self.definition.validate_settings(extras)
        new_extras = extras.dict(exclude_none=True)
        current_extras = {k: v for k, v in self.config.extras.items() if v is not None}
        if current_extras == new_extras:
            return
        self.config.extras = new_extras
        self.mark("extras")

    def set_scope(self, selection: ScopeSelection) -> None:
        """Replace which projects the automation covers, in the form its trigger takes.

        Callers must authorize the change; this only checks that the selection belongs to
        the workflow's organization.
        """
        self.definition.trigger.set_scope(self, selection)
