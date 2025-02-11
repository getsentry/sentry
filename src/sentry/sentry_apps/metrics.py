from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric
from sentry.models.organization import Organization


class SentryAppOperationType(StrEnum):
    """Actions that Sentry Apps can do"""

    PUBLISH_EMAIL_SENT = "publish_email_sent"


@dataclass
class SentryAppOperationEvent(EventLifecycleMetric):
    """An event under the Sentry App umbrella"""

    operation_type: SentryAppOperationType
    integration_name: str | None = None
    organization: Organization | None = None
    region: str | None = None

    def get_integration_name(self) -> str:
        return self.integration_name or ""

    def get_region(self) -> str:
        return self.region or ""

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("sentry_app", str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "operation_type": self.operation_type,
            "integration_name": self.get_integration_name(),
            "region": self.get_region(),
        }
