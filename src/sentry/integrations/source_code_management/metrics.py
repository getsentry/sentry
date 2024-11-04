from enum import Enum

from attr import dataclass

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import EventLifecycleMetric, EventLifecycleOutcome


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
class RepositoryIntegrationInteractionEvent(EventLifecycleMetric):
    """
    An instance to be recorded of a RepositoryIntegration feature call.
    """

    interaction_type: RepositoryIntegrationInteractionType
    provider_key: str

    def get_key(self, outcome: EventLifecycleOutcome) -> str:
        return self.get_standard_key(
            domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            integration_name=self.provider_key,
            interaction_type=str(self.interaction_type),
            outcome=outcome,
        )
