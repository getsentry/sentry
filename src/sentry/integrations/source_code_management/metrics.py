from collections.abc import Mapping
from enum import Enum
from typing import Any

from attr import dataclass

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import RpcOrganizationIntegration
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization


class RepositoryIntegrationInteractionType(Enum):
    """
    A RepositoryIntegration feature.
    """

    GET_STACKTRACE_LINK = "GET_STACKTRACE_LINK"
    GET_CODEOWNER_FILE = "GET_CODEOWNER_FILE"
    CHECK_FILE = "CHECK_FILE"

    def __str__(self) -> str:
        return self.value.lower()


class SourceCodeIssueIntegrationInteractionType(Enum):
    """
    A SourceCodeIssueIntegration feature.
    """

    GET_REPOSITORY_CHOICES = "GET_REPOSITORY_CHOICES"
    CREATE_ISSUE = "CREATE_ISSUE"
    SYNC_STATUS_OUTBOUND = "SYNC_STATUS_OUTBOUND"
    SYNC_ASSIGNEE_OUTBOUND = "SYNC_ASSIGNEE_OUTBOUND"


@dataclass
class RepositoryIntegrationInteractionEvent(IntegrationEventLifecycleMetric):
    """
    An instance to be recorded of a RepositoryIntegration feature call.
    """

    interaction_type: RepositoryIntegrationInteractionType
    provider_key: str

    # Optional attributes to populate extras
    organization: Organization | RpcOrganization | None = None
    org_integration: OrganizationIntegration | RpcOrganizationIntegration | None = None

    def get_integration_domain(self) -> IntegrationDomain:
        return IntegrationDomain.SOURCE_CODE_MANAGEMENT

    def get_integration_name(self) -> str:
        return self.provider_key

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "organization_id": (self.organization.id if self.organization else None),
            "org_integration_id": (self.org_integration.id if self.org_integration else None),
        }


@dataclass
class SourceCodeIssueIntegrationInteractionEvent(IntegrationEventLifecycleMetric):
    """
    An instance to be recorded of a SourceCodeIssueIntegration feature call.
    """

    interaction_type: SourceCodeIssueIntegrationInteractionType
    provider_key: str

    # Optional attributes to populate extras
    organization: Organization | RpcOrganization | None = None
    org_integration: OrganizationIntegration | RpcOrganizationIntegration | None = None

    def get_integration_domain(self) -> IntegrationDomain:
        return IntegrationDomain.SOURCE_CODE_MANAGEMENT

    def get_integration_name(self) -> str:
        return self.provider_key

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "organization_id": (self.organization.id if self.organization else None),
            "org_integration_id": (self.org_integration.id if self.org_integration else None),
        }
