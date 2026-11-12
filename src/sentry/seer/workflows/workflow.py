from __future__ import annotations

import logging
from collections.abc import Collection, Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from functools import partial
from typing import Any, assert_never

from django.db import router, transaction
from django.db.models import Count, Q, QuerySet
from pydantic import BaseModel

from sentry.cadence.api import ScheduledTriggerType, clear_schedule
from sentry.constants import ALL_ACCESS_PROJECTS, ObjectStatus
from sentry.hybridcloud.models.outbox import OutboxDatabaseError, OutboxFlushError, outbox_context
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    MAX_WORKFLOW_CONFIGS_PER_ORG,
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowConfigProject,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunExtras,
    SeerWorkflowRunStatus,
    SeerWorkflowSchedule,
    SeerWorkflowStrategy,
    WorkflowRunSnapshot,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.seer.workflows.schedule import sync_schedule
from sentry.service_accounts.models import (
    MAX_NAME_LENGTH,
    InvalidScopeError,
    ServiceAccountProjectReplica,
    ServiceAccountReplica,
    validate_grantable_scopes,
)
from sentry.service_accounts.outbox import (
    ServiceAccountOwnerKind,
    service_account_create_outbox,
    service_account_grant_update_outbox,
)
from sentry.service_accounts.services.service_account import (
    RpcServiceAccount,
    service_account_service,
)
from sentry.utils import json

logger = logging.getLogger(__name__)

SEER_DEFAULT_WORKFLOW_STRATEGIES = (SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,)


class WorkflowUpdateError(ValueError):
    """A workflow create or update rejected for its input or the workflow's state."""


@dataclass(frozen=True)
class AllProjects:
    pass


@dataclass(frozen=True)
class SelectedProjects:
    project_ids: tuple[int, ...]


type ProjectSelection = AllProjects | SelectedProjects


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


@dataclass(frozen=True, kw_only=True)
class SeerWorkflow:
    """Apply each change to fresh state under the workflow config's row lock.

    Returned models do not carry a lock or refresh automatically. Configuration
    changes, including project selection, should go through these methods.
    """

    config_id: int
    organization_id: int

    @classmethod
    def ensure_defaults(cls, organization_id: int) -> None:
        """Seed defaults for strategies with no config; disabled configs count as existing."""
        database = router.db_for_write(SeerWorkflowConfig)
        configs = SeerWorkflowConfig.objects.using(database).filter(
            organization_id=organization_id,
            strategy__in=[s.value for s in SEER_DEFAULT_WORKFLOW_STRATEGIES],
        )
        existing = set(configs.values_list("strategy", flat=True))
        if all(s.value in existing for s in SEER_DEFAULT_WORKFLOW_STRATEGIES):
            return

        with transaction.atomic(database):
            # Prevent duplicate seeds without a uniqueness constraint on configurable strategies.
            list(
                Organization.objects.using(database).select_for_update().filter(id=organization_id)
            )
            existing = set(configs.values_list("strategy", flat=True))
            SeerWorkflowConfig.objects.using(database).bulk_create(
                [
                    SeerWorkflowConfig(
                        organization_id=organization_id,
                        strategy=strategy.value,
                        filters=SeerWorkflowFilters(all_projects=True).dict(),
                        extras=SeerWorkflowConfigExtras(seeded_default=strategy).dict(
                            exclude_none=True
                        ),
                    )
                    for strategy in SEER_DEFAULT_WORKFLOW_STRATEGIES
                    if strategy.value not in existing
                ]
            )

    @classmethod
    @contextmanager
    def _create_config(
        cls,
        *,
        database: str,
        organization_id: int,
        strategy: SeerWorkflowStrategy,
        enabled: bool,
        filters: SeerWorkflowFilters,
        service_account_grant: SeerServiceAccountGrant,
        extras: SeerWorkflowConfigExtras | None = None,
    ) -> Iterator[SeerWorkflowConfig]:
        """
        Create a config within the org's automation limit, with an outbox that creates its
        service account in control. Writes in the block share the config's
        transaction, so a config is never committed without the outbox that links its
        account.

        The outbox drains when the transaction commits. If that fails, the config is kept
        without an account and the outbox retries in the background.
        """
        _validate_service_account_grant(organization_id, service_account_grant)

        extras = extras or SeerWorkflowConfigExtras()
        try:
            with outbox_context(transaction.atomic(database), flush=True):
                existing = (
                    SeerWorkflowConfig.objects.using(database)
                    .filter(
                        organization_id=organization_id,
                        strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
                    )
                    .count()
                )
                if existing >= MAX_WORKFLOW_CONFIGS_PER_ORG:
                    raise WorkflowUpdateError(
                        f"Organizations can have at most {MAX_WORKFLOW_CONFIGS_PER_ORG} automations"
                    )

                config = SeerWorkflowConfig.objects.using(database).create(
                    organization_id=organization_id,
                    strategy=strategy,
                    enabled=enabled,
                    filters=filters.dict(),
                    extras=extras.dict(exclude_none=True),
                )
                service_account_create_outbox(
                    organization_id=organization_id,
                    owner_kind=ServiceAccountOwnerKind.SEER_WORKFLOW_CONFIG,
                    owner_id=config.id,
                    name=_service_account_name(config.id, extras.name),
                    scope_list=service_account_grant.scopes,
                    project_ids=service_account_grant.project_ids,
                    all_projects=service_account_grant.all_projects,
                    created_by_id=extras.created_by,
                ).save()
                yield config
        except (OutboxFlushError, OutboxDatabaseError):
            logger.exception(
                "seer.workflow.service_account.flush_failed",
                extra={"organization_id": organization_id},
            )

    @classmethod
    def create(
        cls,
        *,
        organization_id: int,
        strategy: SeerWorkflowStrategy,
        enabled: bool = False,
        schedule: SeerWorkflowSchedule,
        project_ids: Collection[int],
        environments: Sequence[str] = (),
        extras: SeerWorkflowConfigExtras | None = None,
        service_account_grant: SeerServiceAccountGrant,
    ) -> SeerWorkflow:
        """
        Create a user-defined automation. Use ``project_ids=[-1]`` to select all
        projects and ``environments=[]`` for all environments. ``service_account_grant`` sets
        the access of the automation's service account. Callers must authorize the grant and audit it.
        """
        if strategy not in SEER_CONFIGURABLE_WORKFLOW_STRATEGIES:
            raise WorkflowUpdateError(f"{strategy} automations cannot be configured")
        if strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
            raise ValueError("Use create_with_monitors for metric workflows")

        project_set = set(project_ids)
        all_projects = project_set == ALL_ACCESS_PROJECTS
        if all_projects:
            # [-1] is not stored as project links, only in config.filters
            project_set = set()
        _validate_project_ids(organization_id, project_set)

        database = router.db_for_write(SeerWorkflowConfig)
        with cls._create_config(
            database=database,
            organization_id=organization_id,
            strategy=strategy,
            enabled=enabled,
            filters=SeerWorkflowFilters(
                all_projects=all_projects,
                environments=list(environments),
            ),
            service_account_grant=service_account_grant,
            extras=extras,
        ) as config:
            config.schedule = schedule
            config.save(using=database, update_fields=["schedule"])
            sync_schedule(config)
            if project_set:
                SeerWorkflowConfigProject.objects.using(database).bulk_create(
                    [
                        SeerWorkflowConfigProject(config=config, project_id=project_id)
                        for project_id in sorted(project_set)
                    ]
                )
            transaction.on_commit(
                partial(
                    logger.info,
                    "seer.workflow.created",
                    extra={
                        "organization_id": organization_id,
                        "config_id": config.id,
                        "config_version": config.version,
                        "strategy": config.strategy,
                        "all_projects": all_projects,
                        "project_ids": list(project_set),
                        "project_count": len(project_set),
                    },
                ),
                using=database,
            )
        return cls(config_id=config.id, organization_id=organization_id)

    def get_config(self) -> SeerWorkflowConfig:
        """Fetch the config without acquiring a lock."""
        return self._config_queryset().get()

    @property
    def extras(self) -> SeerWorkflowConfigExtras:
        return SeerWorkflowConfigExtras.parse_obj(self.get_config().extras)

    @property
    def filters(self) -> SeerWorkflowFilters:
        return SeerWorkflowFilters.parse_obj(self.get_config().filters)

    def get_or_create_run(
        self,
        *,
        trigger_key: str,
        inputs: BaseModel,
        extras: Mapping[str, Any] | None = None,
    ) -> WorkflowRunCreationResult:
        """Retries preserve the original configuration and inputs."""
        if not trigger_key or len(trigger_key) > 256:
            raise ValueError("Trigger keys must contain between 1 and 256 characters")

        with self._lock_config() as config:
            existing = self.get_runs().filter(trigger_key=trigger_key).first()
            if existing is not None:
                return WorkflowRunCreationResult(
                    lifecycle=SeerWorkflowRunLifecycle(
                        run_id=existing.id, organization_id=existing.organization_id
                    ),
                    created=False,
                )

            snapshot = WorkflowRunSnapshot(
                config_version=config.version,
                strategy=SeerWorkflowStrategy(config.strategy),
                filters=config.filters,
                project_ids=tuple(self._get_project_ids(config)),
                output_policy=config.output_policy,
                inputs=json.loads(inputs.json()),
            )
            run_extras = SeerWorkflowRunExtras.parse_obj({**(extras or {}), "snapshot": snapshot})
            run = SeerWorkflowRun.objects.create(
                organization_id=config.organization_id,
                workflow_config=config,
                trigger_key=trigger_key,
                status=SeerWorkflowRunStatus.QUEUED,
                extras=json.loads(run_extras.json()),
            )
            return WorkflowRunCreationResult(
                lifecycle=SeerWorkflowRunLifecycle(
                    run_id=run.id, organization_id=run.organization_id
                ),
                created=True,
            )

    def get_runs(self) -> QuerySet[SeerWorkflowRun]:
        return (
            SeerWorkflowRun.objects.using(router.db_for_write(SeerWorkflowRun))
            .filter(organization_id=self.organization_id, workflow_config_id=self.config_id)
            .order_by("-date_added", "-id")
        )

    def matches_scope(self, project_id: int, environment: str | None) -> bool:
        """Check the automation's scope before recording an admission decision."""
        return self._matches_scope(self.get_config(), project_id, environment)

    def has_quota_available(self) -> bool:
        """Allow runs until automation quota enforcement is implemented."""
        # TODO(telkins): Enforce automation quota before accepting a new run.
        return True

    def get_project_ids(self) -> list[int]:
        """Return active project IDs matching this workflow's filters, in ascending order."""
        return self._get_project_ids(self.get_config())

    def has_all_projects(self) -> bool:
        """
        Return whether this workflow's scope covers every active project in its organization.
        Edge case: always false for empty selections, even if the org has no active projects.
        """
        config = self.get_config()
        selected_projects = self._get_projects(config).values("id")
        counts = Project.objects.filter(
            organization_id=config.organization_id, status=ObjectStatus.ACTIVE
        ).aggregate(
            total=Count("id"),
            selected=Count("id", filter=Q(id__in=selected_projects)),
        )
        return counts["selected"] > 0 and counts["selected"] == counts["total"]

    def delete(self) -> None:
        """Delete the config with its project links, runs, trigger bindings, and service account."""
        self._delete_service_account()
        with self._lock_config() as config:
            config.delete()
            clear_schedule(
                organization_id=self.organization_id,
                trigger_type=ScheduledTriggerType.SEER_WORKFLOW,
                target_id=self.config_id,
            )

    def _delete_service_account(self) -> None:
        service_account_id = self.get_config().service_account_id
        if service_account_id is not None:
            service_account_service.delete_service_account(
                organization_id=self.organization_id, service_account_id=service_account_id
            )

    def get_service_account(self) -> RpcServiceAccount | None:
        """Read the automation's service account from control, which the replica may lag."""
        config = self.get_config()
        if config.service_account_id is None:
            return None
        return service_account_service.get_service_account(
            organization_id=self.organization_id, service_account_id=config.service_account_id
        )

    def resolve_service_account(self) -> ServiceAccountReplica:
        """Resolve authoritative identity against current cell state on every call."""
        config = self.get_config()
        if config.service_account_id is None:
            raise ValueError("Workflow has no service account")
        try:
            replica = ServiceAccountReplica.objects.get(
                service_account_id=config.service_account_id,
                organization_id=config.organization_id,
            )
        except ServiceAccountReplica.DoesNotExist as exc:
            raise ValueError(
                "Service account is unavailable in the workflow's organization"
            ) from exc
        if not replica.is_active:
            raise ValueError("Service account is inactive")
        return replica

    @contextmanager
    def update_config(self) -> Iterator[ConfigUpdate]:
        """Lock the config row for a group of changes that commit or roll back together.

        On a normal exit, any marked changes are saved atomically with a single version bump,
        and the config's schedule is synced to match.
        Do not early return on error cases - propagate an exception so the transaction can roll back.
        """
        try:
            with outbox_context(transaction.atomic(router.db_for_write(SeerWorkflowConfig))):
                update = self._new_config_update(self._config_queryset().select_for_update().get())
                yield update
                if update.changed:
                    update.config.version += 1
                    update.config.save(
                        update_fields=[*sorted(update.dirty_fields), "version", "date_updated"]
                    )
                # Even when unchanged, so a schedule that drifted from the config is repaired.
                sync_schedule(update.config)
        except (OutboxFlushError, OutboxDatabaseError):
            logger.exception(
                "seer.workflow.update.flush_failed",
                extra={"organization_id": self.organization_id, "config_id": self.config_id},
            )

    @classmethod
    def _new_config_update(cls, config: SeerWorkflowConfig) -> ConfigUpdate:
        """Strategies with their own setters override this to return a ConfigUpdate subclass."""
        return ConfigUpdate(config)

    @contextmanager
    def _lock_config(self) -> Iterator[SeerWorkflowConfig]:
        with transaction.atomic(router.db_for_write(SeerWorkflowConfig)):
            yield self._config_queryset().select_for_update().get()

    def _config_queryset(self) -> QuerySet[SeerWorkflowConfig]:
        return SeerWorkflowConfig.objects.using(router.db_for_write(SeerWorkflowConfig)).filter(
            id=self.config_id, organization_id=self.organization_id
        )

    def _matches_scope(
        self, config: SeerWorkflowConfig, project_id: int, environment: str | None
    ) -> bool:
        """Check scope using a config snapshot without modifying it or acquiring a lock."""
        filters = SeerWorkflowFilters.parse_obj(config.filters)
        return (
            config.enabled
            and (not filters.environments or environment in filters.environments)
            and self._get_projects(config).filter(id=project_id).exists()
        )

    def _get_project_ids(self, config: SeerWorkflowConfig) -> list[int]:
        return list(self._get_projects(config).order_by("id").values_list("id", flat=True))

    def _get_projects(self, config: SeerWorkflowConfig) -> QuerySet[Project]:
        """Return active projects in the config's scope; strategies may derive it differently."""
        projects = Project.objects.filter(
            organization_id=config.organization_id, status=ObjectStatus.ACTIVE
        )
        if not SeerWorkflowFilters.parse_obj(config.filters).all_projects:
            projects = projects.filter(
                id__in=SeerWorkflowConfigProject.objects.filter(config=config).values("project_id")
            )
        return projects


@dataclass(frozen=True)
class WorkflowRunCreationResult:
    lifecycle: SeerWorkflowRunLifecycle
    created: bool


@dataclass
class ConfigUpdate:
    """Pending changes to a locked config row.

    Only create one through ``SeerWorkflow.update_config``. Setters should mutate
    ``config`` then mark what they changed after their last step that can fail.
    """

    # Config DB row to update. DO NOT call save() on this directly - use ``update_config``
    config: SeerWorkflowConfig
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
        _validate_service_account_grant(self.config.organization_id, grant)
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

    def set_project_selection(self, selection: ProjectSelection) -> None:
        """Replace the selected projects, bumping the version only when the selection changes.

        Callers must authorize the change; this only checks that the projects belong to the
        workflow's organization.
        """
        match selection:
            case AllProjects():
                all_projects = True
                project_ids: set[int] = set()
            case SelectedProjects(project_ids=selected):
                all_projects = False
                project_ids = set(selected)
            case _:
                assert_never(selection)

        config = self.config
        if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
            raise WorkflowUpdateError(
                "Breached metric projects are selected by connecting monitors"
            )
        _validate_project_ids(config.organization_id, project_ids)

        existing = set(
            SeerWorkflowConfigProject.objects.filter(config=config).values_list(
                "project_id", flat=True
            )
        )
        removed = existing - project_ids
        added = project_ids - existing
        if removed or added:
            SeerWorkflowConfigProject.objects.filter(config=config, project_id__in=removed).delete()
            SeerWorkflowConfigProject.objects.bulk_create(
                [
                    SeerWorkflowConfigProject(config=config, project_id=project_id)
                    for project_id in sorted(added)
                ]
            )
            self.mark_related_changed()

        filters = SeerWorkflowFilters.parse_obj(config.filters)
        if filters.all_projects != all_projects:
            filters.all_projects = all_projects
            config.filters = config.filters | filters.dict()
            self.mark("filters")


def _validate_project_ids(organization_id: int, project_ids: set[int]) -> None:
    valid_project_ids = set(
        Project.objects.filter(organization_id=organization_id, id__in=project_ids).values_list(
            "id", flat=True
        )
    )
    if project_ids != valid_project_ids:
        raise WorkflowUpdateError("Selected projects must exist in the workflow's organization")


def _validate_service_account_grant(organization_id: int, grant: SeerServiceAccountGrant) -> None:
    if not grant.all_projects:
        _validate_project_ids(organization_id, set(grant.project_ids))
    try:
        validate_grantable_scopes(grant.scopes)
    except InvalidScopeError as e:
        raise WorkflowUpdateError(" ".join(e.messages)) from e


def _service_account_name(config_id: int, automation_name: str | None) -> str:
    suffix = f"#{config_id}"
    prefix = f"Seer: {automation_name}" if automation_name else "Seer automation"
    return f"{prefix[: MAX_NAME_LENGTH - len(suffix) - 1]} {suffix}"


class SeerWorkflowServiceAccountOwner:
    def needs_service_account(self, organization_id: int, owner_id: int) -> bool:
        return self._unlinked(organization_id, owner_id).exists()

    def link_service_account(
        self, organization_id: int, owner_id: int, service_account_id: int
    ) -> None:
        # Linking isn't a configuration change, so it doesn't bump the version.
        self._unlinked(organization_id, owner_id).update(service_account_id=service_account_id)

    def _unlinked(self, organization_id: int, config_id: int) -> QuerySet[SeerWorkflowConfig]:
        return SeerWorkflowConfig.objects.filter(
            id=config_id, organization_id=organization_id, service_account_id__isnull=True
        )


SEER_WORKFLOW_SERVICE_ACCOUNT_OWNER = SeerWorkflowServiceAccountOwner()
