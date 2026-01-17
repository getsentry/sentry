from enum import StrEnum
from typing import Any, Protocol

from sentry.sentry_apps.metrics import SentryAppEventType


class SeerEntrypointKey(StrEnum):
    SLACK = "slack"


class SeerEntrypoint[CachePayloadT](Protocol):
    """
    A protocol for external entrypoints (usually integrations) into accessing Seer functionality.
    The idea being, if you want to trigger some operation in Seer, all you should need to do
    is implement this protocol, instantiate it, and pass it to the operator.

    The operator will do all the interfacing with Seer, and the entrypoint will do the interfacing
    with your external service.
    """

    key: SeerEntrypointKey

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

    def create_autofix_cache_payload(self) -> CachePayloadT:
        """
        Creates a cached payload which will be provided to on_autofix_update.

        Example Usage: Persisting a provider thread ID to issue replies, etc.
        """
        ...

    @staticmethod
    def on_autofix_update(
        event_type: SentryAppEventType, event_payload: dict[str, Any], cache_payload: CachePayloadT
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
