import sentry_sdk_alpha
from sentry_sdk_alpha.utils import ContextVar
from sentry_sdk_alpha.integrations import Integration
from sentry_sdk_alpha.scope import add_global_event_processor

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Optional

    from sentry_sdk_alpha._types import Event, Hint


class DedupeIntegration(Integration):
    identifier = "dedupe"

    def __init__(self):
        # type: () -> None
        self._last_seen = ContextVar("last-seen")

    @staticmethod
    def setup_once():
        # type: () -> None
        @add_global_event_processor
        def processor(event, hint):
            # type: (Event, Optional[Hint]) -> Optional[Event]
            if hint is None:
                return event

            integration = sentry_sdk_alpha.get_client().get_integration(DedupeIntegration)
            if integration is None:
                return event

            exc_info = hint.get("exc_info", None)
            if exc_info is None:
                return event

            exc = exc_info[1]
            if integration._last_seen.get(None) is exc:
                return None
            integration._last_seen.set(exc)
            return event

    @staticmethod
    def reset_last_seen():
        # type: () -> None
        integration = sentry_sdk_alpha.get_client().get_integration(DedupeIntegration)
        if integration is None:
            return

        integration._last_seen.set(None)
