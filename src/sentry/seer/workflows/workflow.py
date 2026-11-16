from __future__ import annotations

import logging
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from functools import partial
from typing import Literal, overload

from django.db import router, transaction
from django.db.models import Count, Q, QuerySet

from sentry.constants import ObjectStatus
from sentry.hybridcloud.models.outbox import OutboxDatabaseError, OutboxFlushError, outbox_context
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    MAX_WORKFLOW_CONFIGS_PER_ORG,
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowSchedule,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.base import (
    ConfigUpdate,
    LockedConfig,
    ProjectSelection,
    ScopeSelection,
    SeerServiceAccountGrant,
    SelectedMonitors,
    WorkflowUpdateError,
    lock_config,
    validate_service_account_grant,
)
from sentry.seer.workflows.definitions import get_definition
from sentry.service_accounts.models import (
    MAX_NAME_LENGTH,
    ServiceAccountReplica,
)
from sentry.service_accounts.outbox import (
    ServiceAccountOwnerKind,
    service_account_create_outbox,
)
from sentry.service_accounts.services.service_account import (
    RpcServiceAccount,
    service_account_service,
)

logger = logging.getLogger(__name__)

SEER_DEFAULT_WORKFLOW_STRATEGIES = (SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,)


@dataclass(frozen=True, kw_only=True)
class SeerWorkflow:
    """Read and change one automation's saved configuration.

    Each change applies to fresh state under the config's row lock. Returned models do not
    carry a lock or refresh automatically. What starts the automation's runs and what they do
    come from its strategy's ``AutomationDefinition``.
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

    @overload
    @classmethod
    def create(
        cls,
        *,
        organization_id: int,
        strategy: Literal[SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION],
        enabled: bool = ...,
        schedule: SeerWorkflowSchedule = ...,
        scope: SelectedMonitors,
        environments: Sequence[str] = ...,
        extras: SeerWorkflowConfigExtras | None = ...,
        service_account_grant: SeerServiceAccountGrant,
    ) -> SeerWorkflow: ...

    @overload
    @classmethod
    def create(
        cls,
        *,
        organization_id: int,
        strategy: Literal[SeerWorkflowStrategy.AGENTIC_TRIAGE_V2],
        enabled: bool = ...,
        schedule: SeerWorkflowSchedule = ...,
        scope: ProjectSelection,
        environments: Sequence[str] = ...,
        extras: SeerWorkflowConfigExtras | None = ...,
        service_account_grant: SeerServiceAccountGrant,
    ) -> SeerWorkflow: ...

    @classmethod
    def create(
        cls,
        *,
        organization_id: int,
        strategy: SeerWorkflowStrategy,
        enabled: bool = False,
        schedule: SeerWorkflowSchedule = SeerWorkflowSchedule.DAILY,
        scope: ScopeSelection,
        environments: Sequence[str] = (),
        extras: SeerWorkflowConfigExtras | None = None,
        service_account_grant: SeerServiceAccountGrant,
    ) -> SeerWorkflow:
        """
        Create a user-defined automation within the org's automation limit. ``scope`` takes
        the form the strategy's trigger selects projects by, and ``environments=[]`` means all
        environments. ``service_account_grant`` sets the access of the automation's service
        account, which is independent of ``scope``. Callers must authorize the grant and audit it.

        The config, its scope, and the outbox that creates its service account in control share
        one transaction, so a config is never committed without the outbox that links its
        account. The outbox drains when the transaction commits. If that fails, the config is
        kept without an account and the outbox retries in the background.
        """
        # TODO(telkins): Connect existing default Error Spike monitors when seeding the
        # default automation, and connect new projects' default monitors as they are created.
        if strategy not in SEER_CONFIGURABLE_WORKFLOW_STRATEGIES:
            raise WorkflowUpdateError(f"{strategy} automations cannot be configured")
        extras = extras or SeerWorkflowConfigExtras()
        definition = get_definition(strategy)
        definition.validate_settings(extras)
        validate_service_account_grant(organization_id, service_account_grant)

        database = router.db_for_write(SeerWorkflowConfig)
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
                    schedule=schedule,
                    filters=SeerWorkflowFilters(environments=list(environments)).dict(),
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

                update = ConfigUpdate(LockedConfig(config), definition)
                update.set_scope(scope)
                if update.dirty_fields:
                    config.save(using=database, update_fields=sorted(update.dirty_fields))
                definition.trigger.sync(config)
                transaction.on_commit(
                    partial(
                        logger.info,
                        "seer.workflow.created",
                        extra={
                            "organization_id": organization_id,
                            "config_id": config.id,
                            "config_version": config.version,
                            "strategy": config.strategy,
                        },
                    ),
                    using=database,
                )
        except (OutboxFlushError, OutboxDatabaseError):
            logger.exception(
                "seer.workflow.service_account.flush_failed",
                extra={"organization_id": organization_id},
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

    def get_runs(self) -> QuerySet[SeerWorkflowRun]:
        return (
            SeerWorkflowRun.objects.using(router.db_for_write(SeerWorkflowRun))
            .filter(organization_id=self.organization_id, workflow_config_id=self.config_id)
            .order_by("-date_added", "-id")
        )

    def matches_scope(self, project_id: int, environment: str | None) -> bool:
        """Check the automation's scope before recording an admission decision."""
        config = self.get_config()
        return get_definition(config.strategy).covers(config, project_id, environment)

    def get_project_ids(self) -> list[int]:
        """Return active project IDs in this workflow's scope, in ascending order."""
        config = self.get_config()
        return get_definition(config.strategy).project_ids(config)

    def has_all_projects(self) -> bool:
        """
        Return whether this workflow's scope covers every active project in its organization.
        Edge case: always false for empty selections, even if the org has no active projects.
        """
        config = self.get_config()
        selected_projects = get_definition(config.strategy).trigger.projects(config).values("id")
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
        with lock_config(self.organization_id, self.config_id) as config:
            get_definition(config.strategy).trigger.teardown(config)
            config.delete()

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
        and the trigger is synced to match.
        Do not early return on error cases - propagate an exception so the transaction can roll back.
        """
        try:
            with (
                outbox_context(transaction.atomic(router.db_for_write(SeerWorkflowConfig))),
                lock_config(self.organization_id, self.config_id) as config,
            ):
                definition = get_definition(config.strategy)
                update = ConfigUpdate(config, definition)
                yield update
                if update.changed:
                    config.version += 1
                    config.save(
                        update_fields=[*sorted(update.dirty_fields), "version", "date_updated"]
                    )
                # Even when unchanged, so a schedule that drifted from the config is repaired.
                definition.trigger.sync(config)
        except (OutboxFlushError, OutboxDatabaseError):
            logger.exception(
                "seer.workflow.update.flush_failed",
                extra={"organization_id": self.organization_id, "config_id": self.config_id},
            )

    def _config_queryset(self) -> QuerySet[SeerWorkflowConfig]:
        return SeerWorkflowConfig.objects.using(router.db_for_write(SeerWorkflowConfig)).filter(
            id=self.config_id, organization_id=self.organization_id
        )


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
