from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug


class InstanceHostnameError(Exception):
    """Raised when a supported integration's instance hostname can't be determined."""


def instance_hostname(integration: Integration | RpcIntegration) -> str:
    """Hostname of the integration's instance, whether SaaS or self-hosted."""
    match integration.provider:
        case IntegrationProviderSlug.GITHUB.value:
            return "github.com"
        case IntegrationProviderSlug.GITHUB_ENTERPRISE.value:
            domain_name = integration.metadata.get("domain_name")
            if not domain_name:
                raise InstanceHostnameError(
                    f"Missing domain_name for github_enterprise integration {integration.id}"
                )
            return domain_name.split("/")[0]
        case IntegrationProviderSlug.GITLAB.value:
            instance = integration.metadata.get("instance")
            if not instance:
                raise InstanceHostnameError(
                    f"Missing instance for gitlab integration {integration.id}"
                )
            return instance
        case _:
            raise NotImplementedError(
                f"Instance hostname not implemented for provider: {integration.provider}"
            )
