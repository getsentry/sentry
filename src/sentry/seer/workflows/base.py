from __future__ import annotations

import logging
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated, Any, Literal, NewType, Protocol

from django.db import router, transaction
from django.db.models import QuerySet
from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError

from sentry.constants import ObjectStatus
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
from sentry.service_accounts.models import (
    GrantableScope,
    InvalidScopeError,
    ServiceAccountProjectReplica,
    ServiceAccountReplica,
    parse_grantable_scopes,
)
from sentry.service_accounts.outbox import service_account_grant_update_outbox
from sentry.utils import json
from sentry.workflow_engine.models import Workflow

logger = logging.getLogger(__name__)


class WorkflowUpdateError(ValueError):
    """A workflow create or update rejected for its input or the workflow's state."""


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


@dataclass(frozen=True)
class SeerServiceAccountGrant:
    """The scopes and projects an automation's investigations run with."""

    scopes: Sequence[str]
    project_ids: Sequence[int] = ()
    all_projects: bool = False

    def __post_init__(self) -> None:
        # Sorted and deduplicated so grants with the same access compare equal.
        object.__setattr__(self, "scopes", tuple(sorted(set(self.scopes))))
        object.__setattr__(
            self,
            "project_ids",
            () if self.all_projects else tuple(sorted(set(self.project_ids))),
        )


def validate_service_account_grant(
    organization_id: int, grant: SeerServiceAccountGrant
) -> list[GrantableScope]:
    if not grant.all_projects:
        validate_project_ids(organization_id, set(grant.project_ids))
    try:
        return parse_grantable_scopes(grant.scopes)
    except InvalidScopeError as e:
        raise WorkflowUpdateError(" ".join(e.messages)) from e


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


class AutomationDefinition[Inputs: BaseModel](Protocol):
    """An automation: how its runs start, and which projects those runs cover."""

    # What a firing hands to the automation's action; recorded in the run's snapshot.
    inputs_type: type[Inputs]
    settings_type: type[BaseModel]
    scoped_by: Literal["projects", "monitors"]

    def projects(self, config: SeerWorkflowConfig) -> QuerySet[Project]:
        """Return the active projects in the config's scope."""
        ...

    def setup(self, update: ConfigUpdate, workflow: Workflow) -> None:
        """Attach anything the trigger needs to a new automation's backing workflow."""
        return None

    def set_scope(self, update: ConfigUpdate, selection: ScopeSelection) -> None:
        """Replace the config's scope, marking ``update`` only when something changed."""
        ...

    def sync(self, config: SeerWorkflowConfig) -> None:
        """Bring anything the trigger keeps outside the config in line with it."""
        return None

    def teardown(self, config: SeerWorkflowConfig) -> None:
        """Remove anything the trigger keeps outside the config, before it is deleted."""
        return None

    def project_ids(self, config: SeerWorkflowConfig) -> list[int]:
        return list(self.projects(config).order_by("id").values_list("id", flat=True))

    @staticmethod
    def is_enabled(config: SeerWorkflowConfig) -> bool:
        workflow = config.backing_workflow
        # TODO(telkins): Cascade a deleted backing workflow to its automation.
        return workflow is not None and workflow.enabled and workflow.status == ObjectStatus.ACTIVE

    def covers(self, config: SeerWorkflowConfig, project_id: int, environment: str | None) -> bool:
        filters = SeerWorkflowFilters.parse_obj(config.filters)
        return (
            self.is_enabled(config)
            and (not filters.environments or environment in filters.environments)
            and self.projects(config).filter(id=project_id).exists()
        )

    def validate_settings(self, extras: SeerWorkflowConfigExtras) -> tuple[BaseModel, BaseModel]:
        """Return the parsed trigger and action settings."""
        try:
            return (
                self.settings_type.parse_obj(extras.trigger_settings or {}),
                NoSettings.parse_obj(extras.action_settings or {}),
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
    workflow_dirty_fields: set[str] = field(default_factory=set)
    related_changed: bool = False

    @property
    def changed(self) -> bool:
        return bool(self.dirty_fields) or bool(self.workflow_dirty_fields) or self.related_changed

    def mark(self, *fields: str) -> None:
        """Record changed columns on the config row."""
        self.dirty_fields.update(fields)

    def mark_workflow(self, *fields: str) -> None:
        """Record changed columns on the backing workflow, saved once with the config."""
        self.workflow_dirty_fields.update(fields)

    def mark_related_changed(self) -> None:
        """Record changes outside the row, like project links, that still bump the version."""
        self.related_changed = True

    def setup_backing_workflow(
        self, *, name: str | None, created_by_id: int | None, enabled: bool
    ) -> None:
        """Give a new automation the backing workflow that holds its name and enabled state."""
        workflow = Workflow.objects.create(
            organization_id=self.config.organization_id,
            name=name or "Seer automation",
            type=Workflow.Type.SEER_INVESTIGATION,
            enabled=enabled,
            created_by_id=created_by_id,
            config={"frequency": 0},
        )
        self.config.backing_workflow = workflow
        self.mark("backing_workflow")
        self.definition.setup(self, workflow)

    def set_enabled(self, enabled: bool) -> None:
        workflow = self._backing_workflow()
        if workflow.enabled != enabled:
            workflow.enabled = enabled
            self.mark_workflow("enabled")

    def set_name(self, name: str) -> None:
        workflow = self._backing_workflow()
        if workflow.name != name:
            workflow.name = name
            self.mark_workflow("name")

    def set_environments(self, environments: Sequence[str]) -> None:
        """Replace the environments the automation covers. An empty list means all."""
        filters = SeerWorkflowFilters.parse_obj(self.config.filters)
        if filters.environments != list(environments):
            filters.environments = list(environments)
            self.config.filters = self.config.filters | filters.dict()
            self.mark("filters")

    def _backing_workflow(self) -> Workflow:
        workflow = self.config.backing_workflow
        if workflow is None:
            raise WorkflowUpdateError("The automation has no backing workflow")
        return workflow

    def set_extras(self, extras: SeerWorkflowConfigExtras) -> None:
        self.definition.validate_settings(extras)
        new_extras = extras.dict(exclude_none=True)
        current_extras = {k: v for k, v in self.config.extras.items() if v is not None}
        if current_extras == new_extras:
            return
        self.config.extras = new_extras
        self.mark("extras")

    def current_service_account_grant(self) -> SeerServiceAccountGrant:
        """The grant of the automation's service account, as last replicated to the cell."""
        replica = self._service_account_replica()
        return SeerServiceAccountGrant(
            scopes=replica.scope_list,
            project_ids=list(
                ServiceAccountProjectReplica.objects.filter(service_account=replica).values_list(
                    "project_id", flat=True
                )
            ),
            all_projects=replica.all_projects,
        )

    def set_service_account_grant(self, grant: SeerServiceAccountGrant) -> bool:
        """Replace the scopes and projects of the automation's service account.

        Returns whether the grant differs from the replicated one. Callers must authorize
        the grant and audit a change.
        """
        scopes = validate_service_account_grant(self.config.organization_id, grant)
        replica = self._service_account_replica()
        # Sent even when the replica already matches: it can lag control, and applying the
        # same grant twice changes nothing.
        service_account_grant_update_outbox(
            organization_id=self.config.organization_id,
            service_account_id=replica.service_account_id,
            scope_list=scopes,
            project_ids=grant.project_ids,
            all_projects=grant.all_projects,
        ).save()
        if grant == self.current_service_account_grant():
            return False
        self.mark_related_changed()
        return True

    def _service_account_replica(self) -> ServiceAccountReplica:
        if self.config.service_account_id is None:
            raise WorkflowUpdateError("The automation doesn't have a service account")
        replica = ServiceAccountReplica.objects.get_or_none(
            service_account_id=self.config.service_account_id,
            organization_id=self.config.organization_id,
            is_active=True,
        )
        if replica is None:
            logger.warning(
                "seer.workflow.service_account_missing",
                extra={
                    "organization_id": self.config.organization_id,
                    "config_id": self.config.id,
                    "service_account_id": self.config.service_account_id,
                },
            )
            raise WorkflowUpdateError("The automation's service account can't be found")
        return replica

    def set_scope(self, selection: ScopeSelection) -> None:
        """Replace which projects the automation covers, in the form its trigger takes.

        Callers must authorize the change; this only checks that the selection belongs to
        the workflow's organization.
        """
        self.definition.set_scope(self, selection)
