import logging
from typing import Any

from rest_framework.response import Response

from sentry.models.group import Group
from sentry.seer.autofix.autofix import trigger_autofix as _trigger_autofix
from sentry.seer.autofix.autofix import update_autofix
from sentry.seer.autofix.types import (
    AutofixCreatePRPayload,
    AutofixSelectRootCausePayload,
    AutofixSelectSolutionPayload,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.cache import cache

SEER_OPERATOR_AUTOFIX_UPDATE_EVENTS = {
    SentryAppEventType.SEER_ROOT_CAUSE_STARTED,
    SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
    SentryAppEventType.SEER_SOLUTION_STARTED,
    SentryAppEventType.SEER_SOLUTION_COMPLETED,
    SentryAppEventType.SEER_CODING_STARTED,
    SentryAppEventType.SEER_CODING_COMPLETED,
    SentryAppEventType.SEER_PR_CREATED,
}

logger = logging.getLogger(__name__)


class SeerOperator[CachePayloadT]:
    """
    A class that connects to entrypoint implementations and runs operations for Seer with them.
    It does this to ensure all entrypoints have consistent behavior and responses.
    """

    def __init__(self, entrypoint: SeerEntrypoint[CachePayloadT]):
        self.entrypoint = entrypoint
        self.logging_ctx: dict[str, str] = {"entrypoint_key": str(entrypoint.key)}

    @classmethod
    def get_autofix_cache_key(cls, *, entrypoint_key: str, run_id: int) -> str:
        return f"seer:autofix:{entrypoint_key}:{run_id}"

    def trigger_autofix(
        self,
        *,
        group: Group,
        user: User | RpcUser,
        stopping_point: AutofixStoppingPoint,
        instruction: str | None = None,
        run_id: int | None = None,
    ) -> None:
        self.logging_ctx["group_id"] = str(group.id)
        self.logging_ctx["user_id"] = str(user.id)
        raw_response: Response | None = None

        if not run_id:
            raw_response = _trigger_autofix(
                group=group,
                user=user,
                instruction=instruction,
                stopping_point=stopping_point,
            )
        else:
            payload: (
                AutofixSelectRootCausePayload
                | AutofixSelectSolutionPayload
                | AutofixCreatePRPayload
                | None
            ) = None
            if stopping_point == AutofixStoppingPoint.SOLUTION:
                # TODO(Leander): We need to figure out a way to get the real cause_id for this.
                # Probably need to add it to the root cause webhook from seer's side.
                payload = AutofixSelectRootCausePayload(type="select_root_cause", cause_id=0)
            elif stopping_point == AutofixStoppingPoint.CODE_CHANGES:
                payload = AutofixSelectSolutionPayload(type="select_solution")
            elif stopping_point == AutofixStoppingPoint.OPEN_PR:
                payload = AutofixCreatePRPayload(type="create_pr")
            else:
                logger.error("operator.invalid_stopping_point", extra=self.logging_ctx)
                self.entrypoint.on_trigger_autofix_error(error="Invalid stopping point provided")
                return

            raw_response = update_autofix(run_id=run_id, payload=payload)

        # Type-safety...
        assert raw_response is not None

        error_message = raw_response.data.get("detail")

        # Let the entrypoint signal to the external service that no run was started :/
        if error_message:
            self.logging_ctx["error_message"] = error_message
            logger.info("operator.trigger_autofix_error", extra=self.logging_ctx)
            self.entrypoint.on_trigger_autofix_error(error=error_message)
            return

        run_id = raw_response.data.get("run_id")
        # Shouldn't ever happen, but if it we have no run_id, we can't listen for updates
        if not run_id:
            logger.info("operator.trigger_autofix_no_run_id", extra=self.logging_ctx)
            self.entrypoint.on_trigger_autofix_error(error="An unknown error has occurred")
            return

        # Let the entrypoint signal to the external service that the run started
        self.entrypoint.on_trigger_autofix_success(run_id=run_id)

        # Create a cache payload that will be picked up for subsequent updates
        cache_payload = self.entrypoint.create_autofix_cache_payload()

        if cache_payload:
            cache_key = self.get_autofix_cache_key(
                entrypoint_key=str(self.entrypoint.key), run_id=run_id
            )
            self.logging_ctx["cache_key"] = cache_key
            cache.set(cache_key, cache_payload)
        logger.info("operator.trigger_autofix_success", extra=self.logging_ctx)

    @classmethod
    def process_autofix_updates(
        cls, *, run_id: int, event_type: SentryAppEventType, event_payload: dict[str, Any]
    ) -> None:
        """
        Use the registry to iterate over all entrypoints and check if this run_id has been cached.
        If so, call the entrypoint's handler with the payload it had previously cached.
        """
        logging_ctx = {"event_type": event_type, "run_id": run_id}

        if event_type not in SEER_OPERATOR_AUTOFIX_UPDATE_EVENTS:
            logger.info("operator.skipping_update", extra=logging_ctx)
            return

        for entrypoint_key, entrypoint_cls in entrypoint_registry.registrations.items():
            cache_key = cls.get_autofix_cache_key(entrypoint_key=entrypoint_key, run_id=run_id)
            logging_ctx["cache_key"] = cache_key
            cache_payload = cache.get(cache_key)
            if not cache_payload:
                logger.info("operator.no_cache_payload", extra=logging_ctx)
                continue

            entrypoint_cls.on_autofix_update(
                event_type=event_type, event_payload=event_payload, cache_payload=cache_payload
            )
