from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.models import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric


class ProjectManagementActionType(StrEnum):
    CREATE_EXTERNAL_ISSUE = "create_external_issue"
    OUTBOUND_ASSIGNMENT_SYNC = "outbound_assignment_sync"
    INBOUND_ASSIGNMENT_SYNC = "inbound_assignment_sync"
    COMMENT_SYNC = "comment_sync"
    OUTBOUND_STATUS_SYNC = "outbound_status_sync"
    INBOUND_STATUS_SYNC = "inbound_status_sync"
    LINK_EXTERNAL_ISSUE = "link_external_issue"

    def __str__(self):
        return self.value.lower()


class ProjectManagementHaltReason(StrEnum):
    SYNC_INBOUND_ASSIGNEE_NOT_FOUND = "inbound-assignee-not-found"
    SYNC_NON_SYNC_INTEGRATION_PROVIDED = "sync-non-sync-integration-provided"
    SYNC_INBOUND_SYNC_SKIPPED = "sync-skipped"
    SYNC_INBOUND_MISSING_CHANGELOG_STATUS = "missing-changelog-status"


class ProjectManagementFailuresReason(StrEnum):
    INSTALLATION_STATE_MISSING = "installation-state-missing"


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
