from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug


def instance_hostname(integration: Integration | RpcIntegration) -> str:
    """Hostname of the integration's instance, whether SaaS or self-hosted."""
    match integration.provider:
        case IntegrationProviderSlug.GITHUB.value:
            return "github.com"
        case IntegrationProviderSlug.GITHUB_ENTERPRISE.value:
            return integration.metadata["domain_name"].split("/")[0]
        case IntegrationProviderSlug.GITLAB.value:
            return integration.metadata["instance"]
        case _:
            raise NotImplementedError(
                f"Instance hostname not implemented for provider: {integration.provider}"
            )
