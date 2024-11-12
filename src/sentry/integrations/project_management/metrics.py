from dataclasses import dataclass
from enum import Enum

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.models import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric


class ProjectManagementActionType(Enum):
    CREATE_EXTERNAL_ISSUE = "create_external_issue"
    OUTBOUND_ASSIGNMENT_SYNC = "outbound_assignment_sync"
    INBOUND_ASSIGNMENT_SYNC = "inbound_assignment_sync"
    COMMENT_SYNC = "comment_sync"
    OUTBOUND_STATUS_SYNC = "outbound_status_sync"
    INBOUND_STATUS_SYNC = "inbound_status_sync"
    LINK_EXTERNAL_ISSUE = "link_external_issue"

    def __str__(self):
        return self.value.lower()


@dataclass
class ProjectManagementEvent(IntegrationEventLifecycleMetric):
    action_type: ProjectManagementActionType
    integration: Integration | RpcIntegration

    def get_integration_name(self) -> str:
        return self.integration.provider

    def get_integration_domain(self) -> IntegrationDomain:
        return IntegrationDomain.PROJECT_MANAGEMENT

    def get_interaction_type(self) -> str:
        return str(self.action_type)
