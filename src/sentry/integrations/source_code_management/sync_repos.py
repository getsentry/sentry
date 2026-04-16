"""
Periodic repo sync for SCM integrations.

The beat task (`scm_repo_sync_beat`) runs on a schedule and uses
CursoredScheduler to iterate over all active SCM OrganizationIntegrations.
For each one, it dispatches `sync_repos_for_org` which diffs the provider's
repo list against Sentry's Repository table and creates/disables/re-enables
as needed.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from taskbroker_client.retry import Retry

from sentry import features
from sentry.constants import ObjectStatus
from sentry.features.exceptions import FeatureNotRegistered
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.repo_audit import log_repo_change
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers.integration_repository import get_integration_repository_provider
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.utils import metrics
from sentry.utils.cursored_scheduler import CursoredScheduler
from sentry.utils.iterators import chunked

logger = logging.getLogger(__name__)

# Providers to include in the periodic sync. Each must implement
# get_repositories() returning RepositoryInfo with all fields needed
# by their build_repository_config.
# Perforce is excluded because it cannot derive external_id from its API.
SCM_SYNC_PROVIDERS = [
    "github",
    "github_enterprise",
    "gitlab",
    "bitbucket",
    "bitbucket_server",
    "vsts",
]

SYNC_BATCH_SIZE = 100


def _has_feature(flag: str, org: object) -> bool:
    """Check a feature flag, returning False if the flag isn't registered."""
    try:
        return features.has(flag, org)
    except FeatureNotRegistered:
        return False


@instrumented_task(
    name="sentry.integrations.source_code_management.sync_repos.sync_repos_for_org",
    namespace=integrations_control_tasks,
    retry=Retry(times=3, delay=120),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CONTROL,
)
@retry()
def sync_repos_for_org(organization_integration_id: int) -> None:
    """
    Sync repositories for a single OrganizationIntegration.

    Fetches all repos from the SCM provider, diffs against Sentry's
    Repository table, then dispatches batched apply tasks.
    """
    ctx = _get_sync_context(organization_integration_id)
    if ctx is None:
        return
    integration, rpc_org, provider_key = ctx

    if not _has_feature(f"organizations:{provider_key}-repo-auto-sync", rpc_org):
        return

    provider = f"integrations:{provider_key}"
    dry_run = not _has_feature(f"organizations:{provider_key}-repo-auto-sync-apply", rpc_org)

    with SCMIntegrationInteractionEvent(
        interaction_type=SCMIntegrationInteractionType.SYNC_REPOS,
        integration_id=integration.id,
        organization_id=rpc_org.id,
        provider_key=provider_key,
    ).capture():
        installation = integration.get_installation(organization_id=rpc_org.id)
        assert isinstance(installation, RepositoryIntegration)

        try:
            provider_repos = installation.get_repositories()
        except ApiError as e:
            if installation.is_rate_limited_error(e):
                logger.info(
                    "sync_repos_for_org.rate_limited",
                    extra={
                        "integration_id": integration.id,
                        "organization_id": rpc_org.id,
                    },
                )
            raise

        provider_external_ids = {repo["external_id"] for repo in provider_repos}

        all_repos = repository_service.get_repositories(
            organization_id=rpc_org.id,
            integration_id=integration.id,
            providers=[provider],
        )
        active_repos = [r for r in all_repos if r.status == ObjectStatus.ACTIVE and r.external_id]
        disabled_repos = [
            r for r in all_repos if r.status == ObjectStatus.DISABLED and r.external_id
        ]

        sentry_active_ids = {r.external_id for r in active_repos}
        sentry_disabled_ids = {r.external_id for r in disabled_repos}

        new_ids = provider_external_ids - sentry_active_ids - sentry_disabled_ids
        removed_ids = sentry_active_ids - provider_external_ids
        restored_ids = sentry_disabled_ids & provider_external_ids

        metric_tags = {
            "provider": provider_key,
            "dry_run": str(dry_run),
        }
        metrics.distribution(
            "scm.repo_sync.new_repos", len(new_ids), tags=metric_tags, sample_rate=1.0
        )
        metrics.distribution(
            "scm.repo_sync.removed_repos", len(removed_ids), tags=metric_tags, sample_rate=1.0
        )
        metrics.distribution(
            "scm.repo_sync.restored_repos", len(restored_ids), tags=metric_tags, sample_rate=1.0
        )
        metrics.distribution(
            "scm.repo_sync.provider_total",
            len(provider_external_ids),
            tags=metric_tags,
            sample_rate=1.0,
        )
        metrics.distribution(
            "scm.repo_sync.sentry_active", len(sentry_active_ids), tags=metric_tags, sample_rate=1.0
        )
        metrics.distribution(
            "scm.repo_sync.sentry_disabled",
            len(sentry_disabled_ids),
            tags=metric_tags,
            sample_rate=1.0,
        )

        if new_ids or removed_ids or restored_ids:
            logger.info(
                "scm.repo_sync.diff",
                extra={
                    "provider": provider_key,
                    "integration_id": integration.id,
                    "organization_id": rpc_org.id,
                    "dry_run": dry_run,
                    "provider_total": len(provider_external_ids),
                    "sentry_active": len(sentry_active_ids),
                    "sentry_disabled": len(sentry_disabled_ids),
                    "new": len(new_ids),
                    "removed": len(removed_ids),
                    "restored": len(restored_ids),
                    "new_ids": list(new_ids),
                    "removed_ids": list(removed_ids),
                    "restored_ids": list(restored_ids),
                },
            )

        if dry_run:
            return

        # Build repo configs for new repos
        new_repo_configs = [
            {
                **repo,
                "identifier": str(repo["identifier"]),
                "integration_id": integration.id,
                "installation": integration.id,
            }
            for repo in provider_repos
            if repo["external_id"] in new_ids
        ]
        removed_id_list = list(removed_ids)
        restored_id_list = list(restored_ids)

        # TODO: Switch to apply_async once the tasks are deployed to all workers
        for config_batch in chunked(new_repo_configs, SYNC_BATCH_SIZE):
            create_repos_batch(
                organization_integration_id=organization_integration_id,
                repo_configs=config_batch,
            )

        if _has_feature("organizations:scm-repo-auto-sync-removal", rpc_org):
            for removed_batch in chunked(removed_id_list, SYNC_BATCH_SIZE):
                disable_repos_batch(
                    organization_integration_id=organization_integration_id,
                    external_ids=removed_batch,
                )

        for restored_batch in chunked(restored_id_list, SYNC_BATCH_SIZE):
            restore_repos_batch(
                organization_integration_id=organization_integration_id,
                external_ids=restored_batch,
            )


def _get_sync_context(
    organization_integration_id: int,
) -> tuple[RpcIntegration, RpcOrganization, str] | None:
    """Shared lookup for batch tasks. Returns (integration, rpc_org, provider_key) or None."""
    try:
        oi = OrganizationIntegration.objects.get(
            id=organization_integration_id,
            status=ObjectStatus.ACTIVE,
        )
    except OrganizationIntegration.DoesNotExist:
        logger.info(
            "sync_repos.missing_org_integration",
            extra={"organization_integration_id": organization_integration_id},
        )
        return None

    integration = integration_service.get_integration(
        integration_id=oi.integration_id, status=ObjectStatus.ACTIVE
    )
    if integration is None:
        logger.info(
            "sync_repos.missing_integration",
            extra={"integration_id": oi.integration_id},
        )
        return None

    org_context = organization_service.get_organization_by_id(
        id=oi.organization_id, include_projects=False, include_teams=False
    )
    if org_context is None:
        logger.info(
            "sync_repos.missing_organization",
            extra={"organization_id": oi.organization_id},
        )
        return None

    return integration, org_context.organization, integration.provider


@instrumented_task(
    name="sentry.integrations.source_code_management.sync_repos.create_repos_batch",
    namespace=integrations_control_tasks,
    retry=Retry(times=3, delay=120),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CONTROL,
)
@retry()
def create_repos_batch(
    organization_integration_id: int,
    repo_configs: list[dict[str, object]],
) -> None:
    ctx = _get_sync_context(organization_integration_id)
    if ctx is None:
        return
    integration, rpc_org, provider_key = ctx

    integration_repo_provider = get_integration_repository_provider(integration)
    created_repos, reactivated_repos, _ = integration_repo_provider.create_repositories(
        configs=repo_configs, organization=rpc_org
    )

    for repo in created_repos:
        log_repo_change(
            event_name="REPO_ADDED",
            organization_id=rpc_org.id,
            repo=repo,
            source="automatic SCM syncing",
            provider=provider_key,
        )

    for repo in reactivated_repos:
        log_repo_change(
            event_name="REPO_ENABLED",
            organization_id=rpc_org.id,
            repo=repo,
            source="automatic SCM syncing",
            provider=provider_key,
        )


@instrumented_task(
    name="sentry.integrations.source_code_management.sync_repos.disable_repos_batch",
    namespace=integrations_control_tasks,
    retry=Retry(times=3, delay=120),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CONTROL,
)
@retry()
def disable_repos_batch(
    organization_integration_id: int,
    external_ids: list[str],
) -> None:
    ctx = _get_sync_context(organization_integration_id)
    if ctx is None:
        return
    integration, rpc_org, provider_key = ctx
    provider = f"integrations:{provider_key}"

    if not _has_feature("organizations:scm-repo-auto-sync-removal", rpc_org):
        return

    repository_service.disable_repositories_by_external_ids(
        organization_id=rpc_org.id,
        integration_id=integration.id,
        provider=provider,
        external_ids=external_ids,
    )

    all_repos = repository_service.get_repositories(
        organization_id=rpc_org.id,
        integration_id=integration.id,
        providers=[provider],
    )
    repo_by_external_id = {r.external_id: r for r in all_repos}

    for eid in external_ids:
        removed_repo = repo_by_external_id.get(eid)
        if removed_repo:
            log_repo_change(
                event_name="REPO_DISABLED",
                organization_id=rpc_org.id,
                repo=removed_repo,
                source="automatic SCM syncing",
                provider=provider_key,
            )


@instrumented_task(
    name="sentry.integrations.source_code_management.sync_repos.restore_repos_batch",
    namespace=integrations_control_tasks,
    retry=Retry(times=3, delay=120),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CONTROL,
)
@retry()
def restore_repos_batch(
    organization_integration_id: int,
    external_ids: list[str],
) -> None:
    ctx = _get_sync_context(organization_integration_id)
    if ctx is None:
        return
    integration, rpc_org, provider_key = ctx
    provider = f"integrations:{provider_key}"

    all_repos = repository_service.get_repositories(
        organization_id=rpc_org.id,
        integration_id=integration.id,
        providers=[provider],
    )
    restore_set = set(external_ids)
    for repo in all_repos:
        if repo.external_id in restore_set:
            repo.status = ObjectStatus.ACTIVE
            repository_service.update_repository(organization_id=rpc_org.id, update=repo)
            log_repo_change(
                event_name="REPO_ENABLED",
                organization_id=rpc_org.id,
                repo=repo,
                source="automatic SCM syncing",
                provider=provider_key,
            )


@instrumented_task(
    name="sentry.integrations.source_code_management.sync_repos.scm_repo_sync_beat",
    namespace=integrations_control_tasks,
    silo_mode=SiloMode.CONTROL,
)
def scm_repo_sync_beat() -> None:
    scheduler = CursoredScheduler(
        name="scm_repo_sync",
        schedule_key="scm-repo-sync-beat",
        queryset=OrganizationIntegration.objects.filter(
            integration__provider__in=SCM_SYNC_PROVIDERS,
            integration__status=ObjectStatus.ACTIVE,
            status=ObjectStatus.ACTIVE,
        ),
        task=sync_repos_for_org,
        cycle_duration=timedelta(hours=24),
    )
    scheduler.tick()
