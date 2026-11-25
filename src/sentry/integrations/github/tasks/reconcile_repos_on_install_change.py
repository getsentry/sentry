import logging
from collections.abc import Mapping, Sequence

from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.integrations.github.tasks.sync_repos_on_install_change import (
    audit_repo_changes,
    disable_removed_repos,
)
from sentry.integrations.github_enterprise.repository import GitHubEnterpriseRepositoryProvider
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.repository_reconciliation import RepositoryConfig
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Their on_create_repository is a no-op; a provider that overrides it (e.g. to create
# webhooks) can't be added here without accounting for that.
REPOSITORY_PROVIDERS: dict[str, type[GitHubRepositoryProvider]] = {
    IntegrationProviderSlug.GITHUB.value: GitHubRepositoryProvider,
    IntegrationProviderSlug.GITHUB_ENTERPRISE.value: GitHubEnterpriseRepositoryProvider,
}
# The control task emits the same metric names; this tag tells them apart.
METRIC_TAGS = {"path": "cell"}


@instrumented_task(
    name="sentry.integrations.github.tasks.reconcile_repos_on_install_change",
    namespace=integrations_tasks,
    retry=Retry(times=3, delay=120, on=(Exception,), ignore=(KeyError,)),
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
    silenced_exceptions=(KeyError,),
)
def reconcile_repos_on_install_change(
    *,
    organization_id: int,
    integration_id: int,
    organization_integration_id: int,
    provider: str,
    repos_added: Sequence[Mapping[str, str]],
    repos_removed: Sequence[Mapping[str, str]],
) -> None:
    """
    Applies a GitHub or GitHub Enterprise installation_repositories webhook to one
    organization. Repo items are ``{"external_id", "full_name", "url"}``. Enqueued by
    ``repository_service.schedule_github_repo_reconciliation``.
    """
    provider_cls = REPOSITORY_PROVIDERS.get(provider)
    if provider_cls is None:
        logger.warning(
            "sync_repos_on_install_change.unsupported_provider",
            extra={"organization_id": organization_id, "provider": provider},
        )
        return

    rpc_org = organization_service.get(id=organization_id)
    if rpc_org is None:
        logger.info(
            "sync_repos_on_install_change.missing_organization",
            extra={"organization_id": organization_id},
        )
        return

    metric_tags = {"provider": provider, **METRIC_TAGS}
    metrics.distribution(
        "scm.repo_sync_on_install_change.repos_per_task",
        len(repos_added) + len(repos_removed),
        tags=metric_tags,
        sample_rate=1.0,
    )

    with SCMIntegrationInteractionEvent(
        interaction_type=SCMIntegrationInteractionType.SYNC_REPOS_ON_INSTALL_CHANGE,
        integration_id=integration_id,
        organization_id=organization_id,
        provider_key=provider,
    ).capture():
        # Each step runs in one transaction so its audit rows (outbox-backed in a cell) land
        # with the repo changes, and a retry never skips audit rows for work already done.
        db = router.db_for_write(Repository)
        if repos_added:
            # Built here because GitHub Enterprise's build_repository_config asks control
            # for the host; control sends the URL instead.
            configs: list[RepositoryConfig] = [
                {
                    "name": repo["full_name"],
                    "external_id": repo["external_id"],
                    "url": repo["url"],
                    "config": {"name": repo["full_name"]},
                    "integration_id": integration_id,
                }
                for repo in repos_added
            ]
            with transaction.atomic(db):
                created, updated, _ = provider_cls(
                    id=f"integrations:{provider}"
                ).reconcile_repositories(
                    configs, rpc_org, organization_integration_id=organization_integration_id
                )
                if created:
                    repository_service.auto_link_repos_by_name(
                        organization_id=organization_id, repo_ids=[r.id for r in created]
                    )
                audit_repo_changes("REPO_ADDED", organization_id, created, provider)
                audit_repo_changes("REPO_ENABLED", organization_id, updated, provider)

        if repos_removed:
            with transaction.atomic(db):
                disable_removed_repos(
                    organization_id=organization_id,
                    integration_id=integration_id,
                    provider=provider,
                    external_ids=[repo["external_id"] for repo in repos_removed],
                    metric_tags=metric_tags,
                )
