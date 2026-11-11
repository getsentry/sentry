# Registers the RPC service in every silo at startup, ahead of its first caller.
from sentry.integrations.services.jira_forge import jira_forge_service  # noqa: F401
from sentry.rules import rules

from .actions import JiraCreateTicketAction
from .client import JiraCloudClient
from .handlers import JiraActionHandler  # noqa: F401,F403
from .integration import JiraIntegration, JiraIntegrationProvider

__all__ = (
    "JiraCloudClient",
    "JiraCreateTicketAction",
    "JiraIntegration",
    "JiraIntegrationProvider",
)


rules.add(JiraCreateTicketAction)
