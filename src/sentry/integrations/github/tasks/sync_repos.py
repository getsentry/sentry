"""
Periodic repo sync for GitHub integrations.

The beat task (`github_repo_sync_beat`) runs on a schedule and uses
CursoredScheduler to iterate over all active GitHub OrganizationIntegrations.
For each one, it dispatches `sync_repos_for_org` which diffs GitHub's repo
list against Sentry's Repository table and creates/disables/re-enables as needed.
"""

import logging
from datetime import timedelta

from taskbroker_client.retry import Retry

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.repo_audit import log_repo_change
from sentry.organizations.services.organization import organization_service
from sentry.plugins.providers.integration_repository import get_integration_repository_provider
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.utils import metrics
from sentry.utils.cursored_scheduler import CursoredScheduler

from .link_all_repos import get_repo_config

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.github.tasks.sync_repos.sync_repos_for_org",
    namespace=integrations_control_tasks,
    retry=Retry(times=3, delay=120),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CONTROL,
)
@retry()
def sync_repos_for_org(organization_integration_id: int) -> None:
    """
    Sync repositories for a single OrganizationIntegration.

    Fetches all repos from GitHub, diffs against Sentry's Repository table,
    and creates/disables/re-enables repos as needed.
    """
    try:
        oi = OrganizationIntegration.objects.get(
            id=organization_integration_id,
            status=ObjectStatus.ACTIVE,
        )
    except OrganizationIntegration.DoesNotExist:
        logger.info(
            "sync_repos_for_org.missing_org_integration",
            extra={"organization_integration_id": organization_integration_id},
        )
        return

    integration = integration_service.get_integration(
        integration_id=oi.integration_id, status=ObjectStatus.ACTIVE
    )
    if integration is None:
        logger.info(
            "sync_repos_for_org.missing_integration",
            extra={"integration_id": oi.integration_id},
        )
        return

    organization_id = oi.organization_id
    org_context = organization_service.get_organization_by_id(
        id=organization_id, include_projects=False, include_teams=False
    )
    if org_context is None:
        logger.info(
            "sync_repos_for_org.missing_organization",
            extra={"organization_id": organization_id},
        )
        return

    rpc_org = org_context.organization
    if not features.has("organizations:github-repo-auto-sync", rpc_org):
        return

    provider = f"integrations:{integration.provider}"
    dry_run = not features.has("organizations:github-repo-auto-sync-apply", rpc_org)

    with SCMIntegrationInteractionEvent(
        interaction_type=SCMIntegrationInteractionType.SYNC_REPOS,
        integration_id=integration.id,
        organization_id=organization_id,
        provider_key=integration.provider,
    ).capture():
        installation = integration.get_installation(organization_id=organization_id)
        client = installation.get_client()

        try:
            github_repos = client.get_repos()
        except ApiError as e:
            if installation.is_rate_limited_error(e):
                logger.info(
                    "sync_repos_for_org.rate_limited",
                    extra={
                        "integration_id": integration.id,
                        "organization_id": organization_id,
                    },
                )
            raise

        github_external_ids = {str(repo["id"]) for repo in github_repos}

        all_repos = repository_service.get_repositories(
            organization_id=organization_id,
            integration_id=integration.id,
            providers=[provider],
        )
        active_repos = [r for r in all_repos if r.status == ObjectStatus.ACTIVE and r.external_id]
        disabled_repos = [
            r for r in all_repos if r.status == ObjectStatus.DISABLED and r.external_id
        ]

        sentry_active_ids = {r.external_id for r in active_repos}
        sentry_disabled_ids = {r.external_id for r in disabled_repos}

        new_ids = github_external_ids - sentry_active_ids - sentry_disabled_ids
        removed_ids = sentry_active_ids - github_external_ids
        restored_ids = sentry_disabled_ids & github_external_ids

        metric_tags = {
            "provider": integration.provider,
            "dry_run": str(dry_run),
        }
        metrics.distribution("scm.repo_sync.new_repos", len(new_ids), tags=metric_tags)
        metrics.distribution("scm.repo_sync.removed_repos", len(removed_ids), tags=metric_tags)
        metrics.distribution("scm.repo_sync.restored_repos", len(restored_ids), tags=metric_tags)
        metrics.distribution(
            "scm.repo_sync.provider_total", len(github_external_ids), tags=metric_tags
        )
        metrics.distribution(
            "scm.repo_sync.sentry_active", len(sentry_active_ids), tags=metric_tags
        )
        metrics.distribution(
            "scm.repo_sync.sentry_disabled", len(sentry_disabled_ids), tags=metric_tags
        )

        if new_ids or removed_ids or restored_ids:
            logger.info(
                "scm.repo_sync.diff",
                extra={
                    "provider": integration.provider,
                    "integration_id": integration.id,
                    "organization_id": organization_id,
                    "dry_run": dry_run,
                    "provider_total": len(github_external_ids),
                    "sentry_active": len(sentry_active_ids),
                    "sentry_disabled": len(sentry_disabled_ids),
                    "new": len(new_ids),
                    "removed": len(removed_ids),
                    "restored": len(restored_ids),
                },
            )

        if dry_run:
            return

        repo_by_external_id = {r.external_id: r for r in active_repos + disabled_repos}

        if new_ids:
            integration_repo_provider = get_integration_repository_provider(integration)
            repo_configs = [
                get_repo_config(repo, integration.id)
                for repo in github_repos
                if str(repo["id"]) in new_ids
            ]
            if repo_configs:
                created_repos, reactivated_repos, _ = integration_repo_provider.create_repositories(
                    configs=repo_configs, organization=rpc_org
                )

                for repo in created_repos:
                    log_repo_change(
                        event_name="REPO_ADDED",
                        organization_id=organization_id,
                        repo=repo,
                        source="automatic SCM syncing",
                        provider=integration.provider,
                    )

                for repo in reactivated_repos:
                    log_repo_change(
                        event_name="REPO_ENABLED",
                        organization_id=organization_id,
                        repo=repo,
                        source="automatic SCM syncing",
                        provider=integration.provider,
                    )

        if removed_ids:
            repository_service.disable_repositories_by_external_ids(
                organization_id=organization_id,
                integration_id=integration.id,
                provider=provider,
                external_ids=list(removed_ids),
            )

            for eid in removed_ids:
                removed_repo = repo_by_external_id.get(eid)
                if removed_repo:
                    log_repo_change(
                        event_name="REPO_DISABLED",
                        organization_id=organization_id,
                        repo=removed_repo,
                        source="automatic SCM syncing",
                        provider=integration.provider,
                    )

        if restored_ids:
            for repo in disabled_repos:
                if repo.external_id in restored_ids:
                    repo.status = ObjectStatus.ACTIVE
                    repository_service.update_repository(
                        organization_id=organization_id, update=repo
                    )
                    log_repo_change(
                        event_name="REPO_ENABLED",
                        organization_id=organization_id,
                        repo=repo,
                        source="automatic SCM syncing",
                        provider=integration.provider,
                    )


@instrumented_task(
    name="sentry.integrations.github.tasks.sync_repos.github_repo_sync_beat",
    namespace=integrations_control_tasks,
    silo_mode=SiloMode.CONTROL,
)
def github_repo_sync_beat() -> None:
    scheduler = CursoredScheduler(
        name="github_repo_sync",
        schedule_key="github-repo-sync-beat",
        queryset=OrganizationIntegration.objects.filter(
            integration__provider="github",
            integration__status=ObjectStatus.ACTIVE,
            status=ObjectStatus.ACTIVE,
        ),
        task=sync_repos_for_org,
        cycle_duration=timedelta(hours=24),
    )
    scheduler.tick()
