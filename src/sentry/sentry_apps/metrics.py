from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric
from sentry.sentry_apps.components import RpcSentryAppInstallation
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app.model import RpcSentryApp


class SentryAppInteractionType(StrEnum):
    """Actions that Sentry Apps can do"""

    # Webhook actions
    PREPARE_EVENT_WEBHOOK = "prepare_event_webhook"
    SEND_EVENT_WEBHOOK = "send_event_webhook"

    # External Requests actions
    SELECT_REQUESTER = "select_requester"


@dataclass
class SentryAppInteractionEvent(EventLifecycleMetric):
    """An event under the Sentry App umbrella"""

    operation_type: SentryAppInteractionType
    sentry_app: SentryApp | RpcSentryApp | None = None
    sentry_app_installation: SentryAppInstallation | RpcSentryAppInstallation | None = None
    region: str | None = None

    def get_sentry_app_name(self) -> str:
        return self.sentry_app_name or ""

    def get_region(self) -> str:
        return self.region or ""

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("sentry_app", str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "operation_type": self.operation_type,
            "region": self.get_region(),
        }

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "sentry_app": self.sentry_app_name,
            "installation_uuid": (self.org_integration.id if self.org_integration else None),
        }
