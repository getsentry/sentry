from sentry.integrations.gitlab.constants import GITLAB_CLOUD_BASE_URL
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug


def instance_hostname(integration: RpcIntegration) -> str | None:
    """Hostname of a self-hosted instance, or None for cloud."""
    if integration.provider == IntegrationProviderSlug.GITHUB.value:
        return None
    elif integration.provider == IntegrationProviderSlug.GITHUB_ENTERPRISE.value:
        return integration.metadata["domain_name"].split("/")[0]
    elif integration.provider == IntegrationProviderSlug.GITLAB.value:
        if integration.metadata["base_url"] == GITLAB_CLOUD_BASE_URL:
            return None
        return integration.metadata["instance"]
    raise ValueError(f"Unsupported provider: {integration.provider}")
