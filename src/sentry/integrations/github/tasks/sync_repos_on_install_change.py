import logging
from typing import Literal

from taskbroker_client.retry import Retry

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.github.webhook_types import GitHubInstallationRepo
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.repo_audit import log_repo_change
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers.integration_repository import get_integration_repository_provider
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import integrations_control_tasks

from .link_all_repos import GitHubRepoInputConfig, get_repo_config

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.github.tasks.sync_repos_on_install_change",
    namespace=integrations_control_tasks,
    retry=Retry(times=3, delay=120),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(KeyError,))
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

    provider = f"integrations:{integration.provider}"

    for oi in org_integrations:
        organization_id = oi.organization_id
        rpc_org = organization_service.get(id=organization_id)

        if rpc_org is None:
            logger.info(
                "sync_repos_on_install_change.missing_organization",
                extra={"organization_id": organization_id},
            )
            continue

        if not features.has("organizations:github-repo-auto-sync-webhook", rpc_org):
            continue

        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.SYNC_REPOS_ON_INSTALL_CHANGE,
            integration_id=integration_id,
            organization_id=organization_id,
            provider_key=integration.provider,
        ).capture():
            _sync_repos_for_org(
                integration=integration,
                rpc_org=rpc_org,
                provider=provider,
                repos_added=repos_added,
                repos_removed=repos_removed,
            )


def _sync_repos_for_org(
    *,
    integration: RpcIntegration,
    rpc_org: RpcOrganization,
    provider: str,
    repos_added: list[GitHubInstallationRepo],
    repos_removed: list[GitHubInstallationRepo],
) -> None:
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

    if repos_removed:
        # Look up repos before disabling to get their IDs and names
        external_ids = [str(repo["id"]) for repo in repos_removed]
        existing_repos = repository_service.get_repositories(
            organization_id=rpc_org.id,
            integration_id=integration.id,
            providers=[provider],
        )
        repo_by_eid = {
            r.external_id: r
            for r in existing_repos
            if r.external_id and r.status == ObjectStatus.ACTIVE
        }

        repository_service.disable_repositories_by_external_ids(
            organization_id=rpc_org.id,
            integration_id=integration.id,
            provider=provider,
            external_ids=external_ids,
        )

        for repo in repos_removed:
            eid = str(repo["id"])
            sentry_repo = repo_by_eid.get(eid)
            if sentry_repo:
                log_repo_change(
                    event_name="REPO_DISABLED",
                    organization_id=rpc_org.id,
                    repo=sentry_repo,
                    source="GitHub webhook",
                    provider=integration.provider,
                )
