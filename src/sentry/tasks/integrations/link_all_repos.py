import logging

import sentry_sdk

from sentry.integrations.base import IntegrationProvider
from sentry.models.organization import Organization
from sentry.plugins.base import bindings
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.integrations.github.link_all_repos", queue="integrations")
def link_all_repos(
    integration_provider: IntegrationProvider,
    integration_id: int,
    organization_id: int,
):
    integration = integration_service.get_integration(integration_id=integration_id)
    if not integration:
        logger.error(
            f"{integration_provider.key}.link_all_repos.integration_missing",
            extra={"organization_id": organization_id},
        )
        metrics.incr("github.link_all_repos.error", tags={"type": "missing_integration"})
        return

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.error(
            f"{integration_provider.key}.link_all_repos.organization_missing",
            extra={"organization_id": organization_id},
        )
        metrics.incr(
            f"{integration_provider.key}.link_all_repos.error",
            tags={"type": "missing_organization"},
        )
        return

    installation = integration_service.get_installation(
        integration=integration, organization_id=organization_id
    )

    client = installation.get_client()

    try:
        repositories = client.get_repositories(fetch_max_pages=True)
    except ApiError as e:
        if integration_provider.is_rate_limited_error(e):
            return

        metrics.incr("github.link_all_repos.api_error")
        raise e

    binding_key = "integration-repository.provider"
    provider_key = (
        integration.provider
        if integration.provider.startswith("integrations:")
        else "integrations:" + integration.provider
    )
    provider_cls = bindings.get(binding_key).get(provider_key)
    provider = provider_cls(id=provider_key)

    for repo in repositories:
        try:
            config = {
                "external_id": repo["id"],
                "integration_id": integration_id,
                "identifier": repo["full_name"],
            }
            provider.create_repository(repo_config=config, organization=organization)
        except KeyError:
            continue
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue
