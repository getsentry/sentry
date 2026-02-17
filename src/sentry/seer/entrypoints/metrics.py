from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric


class SeerOperatorInteractionType(StrEnum):
    OPERATOR_TRIGGER_AUTOFIX = "trigger_autofix"
    OPERATOR_PROCESS_AUTOFIX_UPDATE = "process_autofix_update"
    OPERATOR_CACHE_POPULATE_PRE_AUTOFIX = "cache_populate_pre_autofix"
    OPERATOR_CACHE_POPULATE_POST_AUTOFIX = "cache_populate_post_autofix"
    OPERATOR_CACHE_GET = "cache_get"
    OPERATOR_CACHE_MIGRATE = "cache_migrate"
    ENTRYPOINT_ON_TRIGGER_AUTOFIX_ERROR = "entrypoint_on_trigger_autofix_error"
    ENTRYPOINT_ON_TRIGGER_AUTOFIX_SUCCESS = "entrypoint_on_trigger_autofix_success"
    ENTRYPOINT_ON_TRIGGER_AUTOFIX_ALREADY_EXISTS = "entrypoint_on_trigger_autofix_already_exists"
    ENTRYPOINT_CREATE_AUTOFIX_CACHE_PAYLOAD = "entrypoint_create_autofix_cache_payload"
    ENTRYPOINT_ON_AUTOFIX_UPDATE = "entrypoint_on_autofix_update"


@dataclass
class SeerOperatorEventLifecycleMetric(EventLifecycleMetric):
    interaction_type: SeerOperatorInteractionType
    entrypoint_key: str | None = None  # SeerEntrypointKey, but the registry is typed as a str

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("seer", "operator", self.interaction_type, str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        tags = {"interaction_type": str(self.interaction_type)}
        if self.entrypoint_key:
            tags["entrypoint_key"] = str(self.entrypoint_key)
        return tags


class SlackEntrypointInteractionType(StrEnum):
    SEND_THREAD_UPDATE = "send_thread_update"
    PROCESS_THREAD_UPDATE = "process_thread_update"
    SCHEDULE_ALL_THREAD_UPDATES = "schedule_all_thread_updates"
    UPDATE_EXISTING_MESSAGE = "update_existing_message"


@dataclass
class SlackEntrypointEventLifecycleMetric(EventLifecycleMetric):
    interaction_type: SlackEntrypointInteractionType
    integration_id: int
    organization_id: int

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "integration_id": self.integration_id,
            "organization_id": self.organization_id,
        }

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("seer", "entrypoint", "slack", self.interaction_type, str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {"interaction_type": str(self.interaction_type)}
