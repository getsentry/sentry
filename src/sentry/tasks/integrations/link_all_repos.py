import logging

from sentry.plugins.providers.integration_repository import (
    RepoExistsError,
    get_integration_repository_provider,
)
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo import SiloMode
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
    name="sentry.integrations.github.link_all_repos",
    queue="integrations.control",
    max_retries=3,
    silo_mode=SiloMode.CONTROL,
)
@retry(
    exclude=(
        RepoExistsError,
        KeyError,
    )
)
def link_all_repos(
    integration_key: str,
    integration_id: int,
    organization_id: int,
):
    integration = integration_service.get_integration(integration_id=integration_id)
    if not integration:
        logger.error(
            "%s.link_all_repos.integration_missing",
            integration_key,
            extra={"organization_id": organization_id},
        )
        metrics.incr("github.link_all_repos.error", tags={"type": "missing_integration"})
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
        return

    installation = integration.get_installation(organization_id=organization_id)

    client = installation.get_client()

    try:
        repositories = client.get_repositories(fetch_max_pages=True)
    except ApiError as e:
        if installation.is_rate_limited_error(e):
            return

        metrics.incr(f"{integration_key}.link_all_repos.api_error")
        raise e

    integration_repo_provider = get_integration_repository_provider(integration)

    for repo in repositories:
        try:
            config = get_repo_config(repo, integration_id)
            integration_repo_provider.create_repository(repo_config=config, organization=rpc_org)
        except KeyError:
            continue
        except RepoExistsError:
            metrics.incr("sentry.integration_repo_provider.repo_exists")
            continue
