from rest_framework.response import Response

from sentry.models.group import Group
from sentry.seer.autofix.autofix import trigger_autofix
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.cache import cache


class SeerOperator[CachePayloadT]:
    """
    A class that connects to entrypoint implementations and runs operations for Seer with them.
    It does this to ensure all entrypoints have consistent behavior and responses.
    """

    def __init__(self, entrypoint: SeerEntrypoint[CachePayloadT]):
        self.entrypoint = entrypoint

    def get_autofix_cache_key(self, *, entrypoint_key: SeerEntrypointKey, run_id: int) -> str:
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
        cache_key = self.get_autofix_cache_key(entrypoint_key=self.entrypoint.key, run_id=run_id)
        cache.set(cache_key, cache_payload, timeout=60 * 10)  # 10 minutes, for updates

    @classmethod
    def handle_autofix_updates(cls, *, run_id: int) -> None:
        """
        Use the registry to iterate over all entrypoints and check if this run_id has been cached.
        If so, call the entrypoint's handler with the payload it had previously cached.
        """
        for entrypoint_key, entrypoint_cls in entrypoint_registry.registrations.items():
            cache_key = cls.get_autofix_cache_key(entrypoint_key=entrypoint_key, run_id=run_id)
            cache_payload = cache.get(cache_key)
            if not cache_payload:
                continue
            entrypoint_cls.on_autofix_update(cached_payload=cache_payload)
