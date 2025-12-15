from typing import Any

from rest_framework import status
from rest_framework.response import Response

from sentry.models.group import Group
from sentry.seer.autofix.autofix import trigger_autofix, update_autofix_with_user_message
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.cache import cache

SEER_OPERATOR_AUTOFIX_UPDATE_EVENTS = {
    SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
    SentryAppEventType.SEER_SOLUTION_COMPLETED,
    SentryAppEventType.SEER_CODING_COMPLETED,
    SentryAppEventType.SEER_PR_CREATED,
}


class SeerOperator[CachePayloadT]:
    """
    A class that connects to entrypoint implementations and runs operations for Seer with them.
    It does this to ensure all entrypoints have consistent behavior and responses.
    """

    def __init__(self, entrypoint: SeerEntrypoint[CachePayloadT]):
        self.entrypoint = entrypoint

    @classmethod
    def get_autofix_cache_key(cls, *, entrypoint_key: str, run_id: int) -> str:
        return f"seer:autofix:{entrypoint_key}:{run_id}"

    def start_autofix(
        self,
        *,
        group: Group,
        user: User | RpcUser,
        instruction: str | None = None,
    ) -> None:
        raw_response: Response = trigger_autofix(group=group, user=user, instruction=instruction)
        error_message = raw_response.data.get("detail")
        if error_message:
            self.entrypoint.on_trigger_autofix_error(error=error_message)
            return

        run_id = raw_response.data.get("run_id")
        if not run_id:
            self.entrypoint.on_trigger_autofix_error(error="An unknown error has occurred")
            return

        self.entrypoint.on_trigger_autofix_success(run_id=run_id)

        cache_payload = self.entrypoint.setup_on_autofix_update()
        cache_key = self.get_autofix_cache_key(
            entrypoint_key=str(self.entrypoint.key), run_id=run_id
        )
        cache.set(cache_key, cache_payload, timeout=60 * 10)  # 10 minutes, for updates

    def update_autofix(self, *, run_id: int, message: str) -> None:
        response = update_autofix_with_user_message(run_id=run_id, unsafe_message=message)
        if response.status_code != status.HTTP_200_OK:
            self.entrypoint.on_message_autofix_error(
                error=response.data.get("detail", "An unknown error has occurred")
            )
            return
        self.entrypoint.on_message_autofix_success(run_id=run_id)

    @classmethod
    def handle_autofix_updates(
        cls, *, run_id: int, event_name: SentryAppEventType, event_payload: dict[str, Any]
    ) -> None:
        """
        Use the registry to iterate over all entrypoints and check if this run_id has been cached.
        If so, call the entrypoint's handler with the payload it had previously cached.
        """
        if event_name not in SEER_OPERATOR_AUTOFIX_UPDATE_EVENTS:
            # TODO(leander): Maybe we want to issue updates for these other events?
            return

        for entrypoint_key, entrypoint_cls in entrypoint_registry.registrations.items():
            cache_key = cls.get_autofix_cache_key(entrypoint_key=entrypoint_key, run_id=run_id)
            cache_payload = cache.get(cache_key)
            if not cache_payload:
                continue
            entrypoint_cls.on_autofix_update(
                event_name=event_name, event_payload=event_payload, cached_payload=cache_payload
            )
