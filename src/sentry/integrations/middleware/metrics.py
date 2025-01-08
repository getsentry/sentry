from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.utils.metrics import EventLifecycleMetric, EventLifecycleOutcome


class MiddlewareOperationType(StrEnum):
    """Different types of operations that middleware can perform."""

    ENSURE_CONTROL_SILO = "ensure_control_silo"

    GET_RESPONSE_FROM_CONTROL_SILO = "get_response_from_control_silo"
    GET_RESPONSE_FROM_REGION_SILO = "get_response_from_region_silo"
    GET_RESPONSE_FROM_FIRST_REGION = "get_response_from_first_region"
    GET_RESPONSE_FROM_ALL_REGIONS = "get_response_from_all_regions"

    GET_ORGANIZATIONS_FROM_INTEGRATION = "get_organizations_from_integration"


@dataclass
class MiddlewareOperationEvent(EventLifecycleMetric):
    """An instance to be recorded of a middleware operation."""

    operation_type: MiddlewareOperationType
    integration_name: str | None = None
    region: str | None = None

    def get_integration_name(self) -> str:
        return self.integration_name or ""

    def get_region(self) -> str:
        return self.region or ""

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("integration", "middleware", str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "operation_type": self.operation_type,
            "integration_name": self.get_integration_name(),
            "region": self.get_region(),
        }
