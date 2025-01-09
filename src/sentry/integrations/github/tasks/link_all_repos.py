import logging

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.metrics import (
    LinkAllReposHaltReason,
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.organizations.services.organization import organization_service
from sentry.plugins.providers.integration_repository import (
    RepoExistsError,
    get_integration_repository_provider,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def get_repo_config(repo, integration_id):
    return {
        "external_id": repo["id"],
        "integration_id": integration_id,
        "identifier": repo["full_name"],
    }


@instrumented_task(
    name="sentry.integrations.github.tasks.link_all_repos",
    queue="integrations.control",
    max_retries=3,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(RepoExistsError, KeyError))
def link_all_repos(
    integration_key: str,
    integration_id: int,
    organization_id: int,
):

    with SCMIntegrationInteractionEvent(
        interaction_type=SCMIntegrationInteractionType.LINK_ALL_REPOS,
        provider_key=integration_key,
    ).capture() as lifecycle:
        lifecycle.add_extra("organization_id", organization_id)
        integration = integration_service.get_integration(
            integration_id=integration_id, status=ObjectStatus.ACTIVE
        )
        if not integration:
            # TODO: Remove this logger in favor of context manager
            logger.error(
                "%s.link_all_repos.integration_missing",
                integration_key,
                extra={"organization_id": organization_id},
            )
            metrics.incr("github.link_all_repos.error", tags={"type": "missing_integration"})
            lifecycle.record_failure(str(LinkAllReposHaltReason.MISSING_INTEGRATION))
            return

        rpc_org = organization_service.get(id=organization_id)
        if rpc_org is None:
            logger.error(
                "%s.link_all_repos.organization_missing",
                integration_key,
                extra={"organization_id": organization_id},
            )
            metrics.incr(
                f"{integration_key}.link_all_repos.error",
                tags={"type": "missing_organization"},
            )
            lifecycle.record_failure(str(LinkAllReposHaltReason.MISSING_ORGANIZATION))
            return

        installation = integration.get_installation(organization_id=organization_id)

        client = installation.get_client()

        try:
            repositories = client.get_repositories(fetch_max_pages=True)
        except ApiError as e:
            if installation.is_rate_limited_error(e):
                lifecycle.record_halt(str(LinkAllReposHaltReason.RATE_LIMITED))
                return

            metrics.incr(f"{integration_key}.link_all_repos.api_error")
            raise

        integration_repo_provider = get_integration_repository_provider(integration)

        # If we successfully create any repositories, we'll set this to True
        success = False

        for repo in repositories:
            try:
                config = get_repo_config(repo, integration_id)
                integration_repo_provider.create_repository(
                    repo_config=config, organization=rpc_org
                )
                success = True
            except KeyError:
                continue
            except RepoExistsError:
                metrics.incr("sentry.integration_repo_provider.repo_exists")
                continue

        if not success:
            lifecycle.record_halt(str(LinkAllReposHaltReason.REPOSITORY_NOT_CREATED))
