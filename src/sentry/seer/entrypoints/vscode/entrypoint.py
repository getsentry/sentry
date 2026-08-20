from typing import Any, TypedDict

from sentry import features
from sentry.issues.action_log.types import ActionSource
from sentry.models.organization import Organization
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.utils import CodingAgentProviderType
from sentry.seer.entrypoints.registry import agent_entrypoint_registry, autofix_entrypoint_registry
from sentry.seer.entrypoints.types import (
    SeerAgentEntrypoint,
    SeerAutofixEntrypoint,
    SeerEntrypointKey,
)
from sentry.sentry_apps.event_types import SentryAppEventType


class VSCodeCachePayload(TypedDict):
    organization_id: int
    user_id: int


class VSCodeAutofixCachePayload(VSCodeCachePayload):
    group_id: int


class VSCodeAgentEntrypoint(SeerAgentEntrypoint[VSCodeCachePayload]):
    key = SeerEntrypointKey.VSCODE
    enable_coding = True
    enable_embeds = False
    is_interactive = True
    only_current_user = True

    def __init__(self, *, organization_id: int, user_id: int) -> None:
        self.organization_id = organization_id
        self.user_id = user_id

    @staticmethod
    def has_access(organization: Organization | RpcOrganization) -> bool:
        return features.has("organizations:integrations-vscode", organization)

    @staticmethod
    def get_code_mode_tools(organization: Organization) -> str:
        return "off"

    def on_trigger_agent_error(self, *, error: str) -> None:
        pass

    def on_trigger_agent_success(self, *, run_id: int) -> None:
        pass

    def create_agent_cache_payload(self) -> VSCodeCachePayload:
        return {"organization_id": self.organization_id, "user_id": self.user_id}

    @staticmethod
    def on_agent_update(
        cache_payload: VSCodeCachePayload, summary: str | None, run_id: int
    ) -> None:
        # Editor clients poll run state, so completion does not need an outbound notification.
        pass


class VSCodeAutofixEntrypoint(SeerAutofixEntrypoint[VSCodeAutofixCachePayload]):
    key = SeerEntrypointKey.VSCODE
    action_source = ActionSource.VSCODE
    autofix_referrer = AutofixReferrer.VSCODE
    commit_author_referrer = "autofix_open_pr_vscode"

    def __init__(self, *, organization_id: int, user_id: int, group_id: int) -> None:
        self.organization_id = organization_id
        self.user_id = user_id
        self.group_id = group_id

    @staticmethod
    def has_access(organization: Organization) -> bool:
        return features.has("organizations:integrations-vscode", organization)

    def on_trigger_autofix_already_exists(self, *, run_id: int, has_complete_stage: bool) -> None:
        pass

    def on_trigger_autofix_error(self, *, error: str) -> None:
        pass

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        pass

    def on_trigger_handoff_already_exists(
        self, *, run_id: int, target: CodingAgentProviderType, has_complete_stage: bool
    ) -> None:
        pass

    def on_trigger_handoff_error(self, *, error: str) -> None:
        pass

    def on_trigger_handoff_success(self, *, run_id: int, target: CodingAgentProviderType) -> None:
        pass

    def create_autofix_cache_payload(self) -> VSCodeAutofixCachePayload:
        return {
            "organization_id": self.organization_id,
            "user_id": self.user_id,
            "group_id": self.group_id,
        }

    @staticmethod
    def on_autofix_update(
        event_type: SentryAppEventType,
        event_payload: dict[str, Any],
        cache_payload: VSCodeAutofixCachePayload,
    ) -> None:
        # Editor clients poll run state, so updates do not need an outbound notification.
        pass


agent_entrypoint_registry.register(key=SeerEntrypointKey.VSCODE)(VSCodeAgentEntrypoint)
autofix_entrypoint_registry.register(key=SeerEntrypointKey.VSCODE)(VSCodeAutofixEntrypoint)
