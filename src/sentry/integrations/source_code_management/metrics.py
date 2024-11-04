from enum import Enum

from attr import dataclass

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric


class RepositoryIntegrationInteractionType(Enum):
    """
    A RepositoryIntegration feature.
    """

    GET_STACKTRACE_LINK = "GET_STACKTRACE_LINK"
    GET_CODEOWNER_FILE = "GET_CODEOWNER_FILE"
    CHECK_FILE = "CHECK_FILE"

    def __str__(self) -> str:
        return self.value.lower()


@dataclass
class RepositoryIntegrationInteractionEvent(IntegrationEventLifecycleMetric):
    """
    An instance to be recorded of a RepositoryIntegration feature call.
    """

    interaction_type: RepositoryIntegrationInteractionType
    provider_key: str

    def get_integration_domain(self) -> IntegrationDomain:
        return IntegrationDomain.SOURCE_CODE_MANAGEMENT

    def get_integration_name(self) -> str:
        return self.provider_key

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)
