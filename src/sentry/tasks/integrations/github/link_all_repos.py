import logging

from sentry_sdk import capture_exception

from sentry.models.organization import Organization
from sentry.plugins.base import bindings
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations.github.pr_comment import RATE_LIMITED_MESSAGE
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.integrations.github.link_all_repos")
def link_all_repos(integration_id: int, organization_id: int):
    integration = integration_service.get_integration(integration_id=integration_id)
    if not integration:
        logger.error(
            "github.link_all_repos.integration_missing",
            extra={"organization_id": organization_id},
        )
        metrics.incr("github.link_all_repos.error", tags={"type": "missing_integration"})
        return

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.error(
            "github.link_all_repos.orgnanization_missing",
            extra={"organization_id": organization_id},
        )
        metrics.incr("github.link_all_repos.error", tags={"type": "missing_organization"})
        return

    installation = integration_service.get_installation(
        integration=integration, organization_id=organization_id
    )

    gh_client = installation.get_client()

    try:
        gh_repositories = gh_client.get_repositories(fetch_max_pages=True)
    except ApiError as e:
        if e.json and RATE_LIMITED_MESSAGE in e.json.get("message", ""):
            metrics.incr("github.link_all_repos.rate_limited_error")
            return

        metrics.incr("github.link_all_repos.api_error")
        raise e

    binding_key = "integration-repository.provider"
    provider_cls = bindings.get(binding_key).get("integrations:" + integration.provider)
    provider = provider_cls(id=integration.provider)

    for repo in gh_repositories:
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
            capture_exception(e)
            continue
