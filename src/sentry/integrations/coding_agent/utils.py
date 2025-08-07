from __future__ import annotations

from sentry.integrations.coding_agent.integration import CodingAgentIntegrationProvider


def get_coding_agent_providers() -> list[str]:
    """Get list of all coding agent provider keys."""
    from sentry.integrations.manager import all

    coding_agent_providers = []

    for provider in all():
        try:
            # Check if the provider is a coding agent provider
            if issubclass(provider.__class__, CodingAgentIntegrationProvider):
                coding_agent_providers.append(provider.key)
        except (TypeError, AttributeError):
            continue

    return coding_agent_providers
