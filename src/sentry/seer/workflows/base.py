from __future__ import annotations

import logging
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Literal, NewType, Protocol

from django.db import router, transaction
from django.db.models import QuerySet
from pydantic import BaseModel, ValidationError

from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowFilters,
)
from sentry.seer.workflows.action_settings import InvestigationSettings
from sentry.seer.workflows.configuration import investigation_actions, is_enabled
from sentry.service_accounts.models import (
    InvalidScopeError,
    ServiceAccountProjectReplica,
    ServiceAccountReplica,
    validate_grantable_scopes,
)
from sentry.service_accounts.outbox import service_account_grant_update_outbox
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


def validate_service_account_grant(organization_id: int, grant: SeerServiceAccountGrant) -> None:
    if not grant.all_projects:
        validate_project_ids(organization_id, set(grant.project_ids))
    try:
        validate_grantable_scopes(grant.scopes)
    except InvalidScopeError as e:
        raise WorkflowUpdateError(" ".join(e.messages)) from e


# A config row read with ``select_for_update`` inside the current transaction.
LockedConfig = NewType("LockedConfig", SeerWorkflowConfig)


@contextmanager
def lock_config(organization_id: int, config_id: int) -> Iterator[LockedConfig]:
    """Hold the config's row lock for the block. Raises DoesNotExist for a missing config."""
    database = router.db_for_write(SeerWorkflowConfig)
    with transaction.atomic(database):
        config = (
            SeerWorkflowConfig.objects.using(database)
            .select_for_update()
            .get(id=config_id, organization_id=organization_id)
        )
        if config.backing_workflow_id is not None:
            config.backing_workflow = (
                Workflow.objects_for_deletion.using(database)
                .select_for_update()
                .get(id=config.backing_workflow_id, organization_id=organization_id)
            )
        yield LockedConfig(config)


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


@dataclass(frozen=True)
class AutomationConfiguration[Inputs: BaseModel]:
    trigger: AutomationTrigger[Inputs]

    def project_ids(self, config: SeerWorkflowConfig) -> list[int]:
        return list(self.trigger.projects(config).order_by("id").values_list("id", flat=True))

    def covers(self, config: SeerWorkflowConfig, project_id: int, environment: str | None) -> bool:
        filters = SeerWorkflowFilters.parse_obj(config.filters)
        return (
            is_enabled(config)
            and (not filters.environments or environment in filters.environments)
            and self.trigger.projects(config).filter(id=project_id).exists()
        )

    def validate_settings(self, extras: SeerWorkflowConfigExtras) -> tuple[BaseModel, BaseModel]:
        """Return the parsed trigger and action settings."""
        try:
            return (
                self.trigger.settings_type.parse_obj(extras.trigger_settings or {}),
                InvestigationSettings.parse_obj(extras.action_settings or {}),
            )
        except ValidationError as e:
            raise WorkflowUpdateError(
                "; ".join(
                    f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                    for error in e.errors()
                )
            ) from e


@dataclass
class ConfigUpdate:
    """Pending changes to a locked config row.

    Only create one through ``SeerWorkflow``. Setters should mutate ``config`` then mark
    what they changed after their last step that can fail.
    """

    # Config DB row to update. DO NOT call save() on this directly - use ``update_config``
    config: LockedConfig
    definition: AutomationConfiguration[Any]
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
        workflow = self.config.backing_workflow
        if workflow is None:
            raise WorkflowUpdateError("The automation has no backing workflow")
        if workflow.enabled != enabled:
            workflow.update(enabled=enabled)
            self.mark_related_changed()

    def set_extras(self, extras: SeerWorkflowConfigExtras) -> None:
        self.definition.validate_settings(extras)
        workflow = self.config.backing_workflow
        if workflow is None:
            raise WorkflowUpdateError("The automation has no backing workflow")
        fields: dict[str, Any] = {}
        if extras.name is not None and workflow.name != extras.name:
            fields["name"] = extras.name
        if extras.created_by is not None and workflow.created_by_id != extras.created_by:
            fields["created_by_id"] = extras.created_by
        if fields:
            workflow.update(**fields)
            self.mark_related_changed()
        if extras.action_settings is not None:
            action = investigation_actions(self.config).get()
            data = InvestigationSettings.parse_obj(extras.action_settings).dict()
            if action.data != data:
                action.update(data=data)
                self.mark_related_changed()
        new_extras = extras.dict(
            exclude_none=True, exclude={"name", "created_by", "action_settings"}
        )
        if self.config.extras != new_extras:
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
        validate_service_account_grant(self.config.organization_id, grant)
        replica = self._service_account_replica()
        # Sent even when the replica already matches: it can lag control, and applying the
        # same grant twice changes nothing.
        service_account_grant_update_outbox(
            organization_id=self.config.organization_id,
            service_account_id=replica.service_account_id,
            scope_list=grant.scopes,
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
        replica = ServiceAccountReplica.objects.filter(
            service_account_id=self.config.service_account_id,
            organization_id=self.config.organization_id,
            is_active=True,
        ).first()
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
        self.definition.trigger.set_scope(self, selection)
