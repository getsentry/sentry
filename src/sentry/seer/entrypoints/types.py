from enum import StrEnum
from typing import Any, Literal, Protocol, TypedDict

from sentry.models.organization import Organization
from sentry.seer.autofix.utils import CodingAgentProviderType
from sentry.sentry_apps.metrics import SentryAppEventType


class SeerEntrypointKey(StrEnum):
    SLACK = "slack"


class SeerAutofixEntrypoint[CachePayloadT](Protocol):
    """
    Protocol for entrypoints that support autofix workflows.
    Implement this to trigger autofix operations and receive updates via the operator.
    """

    key: SeerEntrypointKey

    @staticmethod
    def has_access(organization: Organization) -> bool:
        """
        Used by the operator (SeerAutofixOperator.has_access) to gate access unless
        the organization has access to at least one entrypoint. The operator will check for
        seer-access prior to this check, so no need to repeat that check on the entrypoint.
        """
        ...

    def on_trigger_autofix_already_exists(self, *, run_id: int, has_complete_stage: bool) -> None:
        """
        Called when an autofix run already exists for the group.
        Also passes the most recent state from the matching stopping_point step for convenience.

        Example Usage: Sending a 'run in progress' message, etc.
        """
        ...

    def on_trigger_autofix_error(self, *, error: str) -> None:
        """
        Called when an autofix failed to start.

        Example Usage: Adding a :x: reaction, sending a failure message, etc.
        """
        ...

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        """
        Called when an autofix run has been started successfully.

        Example Usage: Adding an :hourglass: reaction, sending a temporary message, etc.
        """
        ...

    def on_trigger_handoff_already_exists(
        self, *, run_id: int, target: CodingAgentProviderType, has_complete_stage: bool
    ) -> None:
        """
        Called when a coding-agent handoff was already launched for the run

        Example Usage: Sending a 'handoff in progress' message, etc.
        """
        ...

    def on_trigger_handoff_error(self, *, error: str) -> None:
        """Called when a coding-agent handoff failed to start.'

        Example Usage: Sending a 'Cursor failed to start' message, etc.
        """
        ...

    def on_trigger_handoff_success(self, *, run_id: int, target: CodingAgentProviderType) -> None:
        """Called when a coding-agent handoff has been launched successfully.

        Example Usage: Mentioning the hand-off agent, etc.
        """
        ...

    def create_autofix_cache_payload(self) -> CachePayloadT:
        """
        Creates a cached payload which will be provided to on_autofix_update.

        Example Usage: Persisting a provider thread ID to issue replies, etc.
        """
        ...

    @staticmethod
    def on_autofix_update(
        event_type: SentryAppEventType,
        event_payload: dict[str, Any],
        cache_payload: CachePayloadT,
    ) -> None:
        """
        Called when an autofix update is received (via Seer's webhooks).
        The shape of the cached payload is determined by `create_autofix_cache_payload`.
        The event_type, and event_payload are webhook payloads emitted by Seer for Sentry Apps.

        Example Usage: Reply with an update in a thread, Give links to the run in Sentry, etc.

        Note: This is a static method, the entrypoint instance will NOT be persisted while autofix
        updates are being received, so leverage the cached payload to persist any state.
        """
        ...


class SeerAgentEntrypoint[CachePayloadT](Protocol):
    """
    Protocol for entrypoints that support Seer Agent workflows.
    Implement this to trigger Agent operations and receive completion updates.
    """

    key: SeerEntrypointKey

    @staticmethod
    def has_access(organization: Organization) -> bool:
        """
        Used to gate access unless the organization has access to at least one entrypoint.
        The caller will check for seer-access prior to this check, so no need to repeat
        that check on the entrypoint.
        """
        ...

    def on_trigger_agent_error(self, *, error: str) -> None:
        """Called when the Agent failed to start."""
        ...

    def on_trigger_agent_success(self, *, run_id: int) -> None:
        """Called when an Agent run started successfully."""
        ...

    def create_agent_cache_payload(self) -> CachePayloadT:
        """Creates cached payload for the Agent completion hook."""
        ...

    @staticmethod
    def on_agent_update(
        cache_payload: CachePayloadT,
        summary: str | None,
        run_id: int,
    ) -> None:
        """
        Called when an Agent run completes, via AgentOnCompletionHook.

        Unlike on_autofix_update which receives streaming webhook events during a run,
        this is invoked once when the Agent run reaches a terminal state. The completion
        hook (AgentOnCompletionHook.execute) retrieves the cached payload, fetches the
        run state from Seer, and delegates to this method so the entrypoint can notify the
        external service (e.g., post a thread reply with the Agent summary and result link).

        The shape of the cached payload is determined by `create_agent_cache_payload`.

        Note: This is a static method. The entrypoint instance is NOT persisted between
        trigger and completion, so leverage the cached payload to persist any state.
        """
        ...


class SeerOperatorCacheResult[CachePayloadT](TypedDict):
    payload: CachePayloadT
    source: Literal["group_id", "run_id"]
    key: str
