from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.models import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric


class GitLabTaskInteractionType(StrEnum):
    """
    GitLab background task interaction types
    """

    UPDATE_ALL_PROJECT_WEBHOOKS = "update_all_project_webhooks"
    UPDATE_PROJECT_WEBHOOK = "update_project_webhook"


class GitLabWebhookUpdateHaltReason(StrEnum):
    """
    Reasons why a GitLab webhook update may halt without success/failure
    """

    INTEGRATION_NOT_FOUND = "integration_not_found"
    ORG_INTEGRATION_NOT_FOUND = "org_integration_not_found"
    NO_REPOSITORIES = "no_repositories"
    REPOSITORY_NOT_FOUND = "repository_not_found"
    MISSING_WEBHOOK_CONFIG = "missing_webhook_config"


@dataclass
class GitLabTaskEvent(IntegrationEventLifecycleMetric):
    """
    An instance to be recorded of a GitLab background task execution
    """

    interaction_type: GitLabTaskInteractionType
    integration: Integration | RpcIntegration

    def get_integration_name(self) -> str:
        return self.integration.provider

    def get_integration_domain(self) -> IntegrationDomain:
        return IntegrationDomain.PROJECT_MANAGEMENT

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)
