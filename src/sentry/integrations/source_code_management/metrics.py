from collections.abc import Mapping
from enum import Enum, StrEnum
from typing import Any

from attr import dataclass

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import RpcOrganizationIntegration
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization


class SCMIntegrationInteractionType(Enum):
    """
    SCM integration features
    """

    # RepositoryIntegration
    GET_STACKTRACE_LINK = "GET_STACKTRACE_LINK"
    GET_CODEOWNER_FILE = "GET_CODEOWNER_FILE"
    CHECK_FILE = "CHECK_FILE"

    # SourceCodeIssueIntegration (SCM only)
    GET_REPOSITORY_CHOICES = "GET_REPOSITORY_CHOICES"

    # CommitContextIntegration
    CREATE_COMMENT = "CREATE_COMMENT"
    UPDATE_COMMENT = "UPDATE_COMMENT"

    # Tasks
    LINK_ALL_REPOS = "LINK_ALL_REPOS"

    def __str__(self) -> str:
        return self.value.lower()


@dataclass
class SCMIntegrationInteractionEvent(IntegrationEventLifecycleMetric):
    """
    An instance to be recorded of a RepositoryIntegration feature call.
    """

    interaction_type: SCMIntegrationInteractionType
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


class LinkAllReposHaltReason(StrEnum):
    """Common reasons why a link all repos task may halt without success/failure."""

    MISSING_INTEGRATION = "missing_integration"
    MISSING_ORGANIZATION = "missing_organization"
    RATE_LIMITED = "rate_limited"
    REPOSITORY_NOT_CREATED = "repository_not_created"
