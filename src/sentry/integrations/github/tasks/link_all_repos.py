import logging
from typing import Any

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
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.taskworker.retry import Retry

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
    taskworker_config=TaskworkerConfig(
        namespace=integrations_control_tasks,
        retry=Retry(times=3),
        processing_deadline_duration=60,
    ),
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
            lifecycle.record_failure(str(LinkAllReposHaltReason.MISSING_INTEGRATION))
            return

        rpc_org = organization_service.get(id=organization_id)
        if rpc_org is None:
            lifecycle.record_failure(str(LinkAllReposHaltReason.MISSING_ORGANIZATION))
            return

        installation = integration.get_installation(organization_id=organization_id)

        client = installation.get_client()

        try:
            repositories = client.get_repos()
        except ApiError as e:
            if installation.is_rate_limited_error(e):
                lifecycle.record_halt(str(LinkAllReposHaltReason.RATE_LIMITED))
                return

            raise

        integration_repo_provider = get_integration_repository_provider(integration)

        repo_configs: list[dict[str, Any]] = []
        missing_repos = []
        for repo in repositories:
            try:
                repo_configs.append(get_repo_config(repo, integration_id))
            except KeyError:
                missing_repos.append(repo)
                continue

        try:
            integration_repo_provider.create_repositories(
                configs=repo_configs, organization=rpc_org
            )
        except RepoExistsError as e:
            lifecycle.record_halt(
                str(LinkAllReposHaltReason.REPOSITORY_NOT_CREATED),
                {"missing_repos": e.repos, "integration_id": integration_id},
            )

        if missing_repos:
            lifecycle.record_halt(
                str(LinkAllReposHaltReason.REPOSITORY_NOT_CREATED),
                {"missing_repos": missing_repos, "integration_id": integration_id},
            )
