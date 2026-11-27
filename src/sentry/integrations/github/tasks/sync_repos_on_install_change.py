import logging
from collections.abc import Mapping, Sequence
from typing import Literal

from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.integrations.github.webhook_types import GitHubInstallationRepo
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.repo_audit import log_repo_change
from sentry.integrations.source_code_management.sync_repos import (
    DISABLE_ACTIVITY_CUTOFF_DAYS,
    bump_org_integration_last_sync,
)
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers.integration_repository import get_integration_repository_provider
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.utils import metrics

from .link_all_repos import GitHubRepoInputConfig, get_repo_config

logger = logging.getLogger(__name__)

AUDIT_SOURCE = "GitHub webhook"


@instrumented_task(
    name="sentry.integrations.github.tasks.sync_repos_on_install_change",
    namespace=integrations_control_tasks,
    retry=Retry(times=3, delay=120, on=(Exception,), ignore=(KeyError,)),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CONTROL,
    silenced_exceptions=(KeyError,),
)
def sync_repos_on_install_change(
    integration_id: int,
    action: str,
    repos_added: list[GitHubInstallationRepo],
    repos_removed: list[GitHubInstallationRepo],
    repository_selection: Literal["all", "selected"],
) -> None:
    """
    Handle GitHub installation_repositories webhook events.

    Creates Repository records for newly accessible repos and disables
    records for repos that are no longer accessible, across all orgs
    linked to the integration.
    """
    result = integration_service.organization_contexts(integration_id=integration_id)
    integration = result.integration
    org_integrations = result.organization_integrations

    if integration is None or integration.status != ObjectStatus.ACTIVE:
        logger.info(
            "sync_repos_on_install_change.missing_or_inactive_integration",
            extra={"integration_id": integration_id},
        )
        return

    if not org_integrations:
        logger.info(
            "sync_repos_on_install_change.no_org_integrations",
            extra={"integration_id": integration_id},
        )
        return

    for oi in org_integrations:
        organization_id = oi.organization_id
        rpc_org = organization_service.get(id=organization_id)

        if rpc_org is None:
            logger.info(
                "sync_repos_on_install_change.missing_organization",
                extra={"organization_id": organization_id},
            )
            continue

        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.SYNC_REPOS_ON_INSTALL_CHANGE,
            integration_id=integration_id,
            organization_id=organization_id,
            provider_key=integration.provider,
        ).capture():
            repos_changed = _sync_repos_for_org(
                integration=integration,
                rpc_org=rpc_org,
                repos_added=repos_added,
                repos_removed=repos_removed,
            )
            bump_org_integration_last_sync(oi.id, repos_changed=repos_changed)


def _sync_repos_for_org(
    *,
    integration: RpcIntegration,
    rpc_org: RpcOrganization,
    repos_added: list[GitHubInstallationRepo],
    repos_removed: list[GitHubInstallationRepo],
) -> bool:
    """Returns True if any repos were created, reactivated, or disabled."""
    changed = False

    if repos_added:
        integration_repo_provider = get_integration_repository_provider(integration)
        repo_configs: list[GitHubRepoInputConfig] = []
        for repo in repos_added:
            try:
                repo_configs.append(get_repo_config(repo, integration.id))
            except KeyError:
                logger.exception("Failed to translate repository config")
                continue

        if repo_configs:
            created_repos, reactivated_repos, _missing_repos = (
                integration_repo_provider.create_repositories(
                    configs=repo_configs, organization=rpc_org
                )
            )
            changed = bool(created_repos or reactivated_repos)

            if created_repos:
                repository_service.auto_link_repos_by_name(
                    organization_id=rpc_org.id, repo_ids=[r.id for r in created_repos]
                )

            for created_repo in created_repos:
                log_repo_change(
                    event_name="REPO_ADDED",
                    organization_id=rpc_org.id,
                    repo=created_repo,
                    source="GitHub webhook",
                    provider=integration.provider,
                )

            for reactivated_repo in reactivated_repos:
                log_repo_change(
                    event_name="REPO_ENABLED",
                    organization_id=rpc_org.id,
                    repo=reactivated_repo,
                    source="GitHub webhook",
                    provider=integration.provider,
                )

    if not repos_removed:
        return changed

    disabled = disable_removed_repos(
        organization_id=rpc_org.id,
        integration_id=integration.id,
        provider=integration.provider,
        external_ids=[str(repo["id"]) for repo in repos_removed],
        metric_tags={"provider": integration.provider},
    )
    return disabled or changed


def disable_removed_repos(
    *,
    organization_id: int,
    integration_id: int,
    provider: str,
    external_ids: Sequence[str],
    metric_tags: Mapping[str, str],
) -> bool:
    """
    Disables the repos an installation lost access to, except recently active ones, and
    audits each one that was active. Returns whether it disabled anything. It opens no
    transaction, so a caller can include it in its own.
    """
    provider_id = f"integrations:{provider}"
    active_skipped = set(
        repository_service.find_recently_active_repo_external_ids(
            organization_id=organization_id,
            integration_id=integration_id,
            provider=provider_id,
            external_ids=list(external_ids),
            cutoff_days=DISABLE_ACTIVITY_CUTOFF_DAYS,
        )
    )
    safe_to_disable = [eid for eid in external_ids if eid not in active_skipped]

    if active_skipped:
        logger.info(
            "sync_repos_on_install_change.disable_skipped_due_to_activity",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "candidate_count": len(external_ids),
                "skipped_count": len(active_skipped),
                "skipped_ids": list(active_skipped),
                "cutoff_days": DISABLE_ACTIVITY_CUTOFF_DAYS,
            },
        )
        metrics.distribution(
            "scm.repo_sync_on_install_change.disable_skipped_due_to_activity",
            len(active_skipped),
            tags=dict(metric_tags),
            sample_rate=1.0,
        )

    if not safe_to_disable:
        return False

    previously_active = [
        repo
        for repo in repository_service.get_repositories(
            organization_id=organization_id,
            integration_id=integration_id,
            providers=[provider_id],
            external_ids=safe_to_disable,
        )
        if repo.status == ObjectStatus.ACTIVE
    ]
    repository_service.disable_repositories_by_external_ids(
        organization_id=organization_id,
        integration_id=integration_id,
        provider=provider_id,
        external_ids=safe_to_disable,
    )
    audit_repo_changes("REPO_DISABLED", organization_id, previously_active, provider)
    return True


def audit_repo_changes(
    event_name: str, organization_id: int, repos: Sequence[RpcRepository], provider: str
) -> None:
    for repo in repos:
        log_repo_change(
            event_name=event_name,
            organization_id=organization_id,
            repo=repo,
            source=AUDIT_SOURCE,
            provider=provider,
        )
