# RPC services register when their module is imported, and this package is loaded at
# startup in every silo, so cells can serve jira_forge before control calls it.
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
