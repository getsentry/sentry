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
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
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


# The cache here will not stop entrypoints from triggering autofixupdates, it only affects the
# entrypoint's ability to receive updates from those triggers. So 12 is plenty, even accounting for
# incidents, since a run should not take nearly that long to complete.
AUTOFIX_CACHE_TIMEOUT_SECONDS = 60 * 60 * 12  # 12 hours
PROCESS_AUTOFIX_TIMEOUT_SECONDS = 60 * 5  # 5 minutes


class SeerOperator[CachePayloadT]:
    """
    A class that connects to entrypoint implementations and runs operations for Seer with them.
    It does this to ensure all entrypoints have consistent behavior and responses.
    """

    def __init__(self, entrypoint: SeerEntrypoint[CachePayloadT]):
        self.entrypoint = entrypoint
        self.logging_ctx: dict[str, str] = {"entrypoint_key": str(entrypoint.key)}

    @classmethod
    def get_pre_autofix_cache_key(cls, *, entrypoint_key: str, group_id: int) -> str:
        """
        The group cache key is used to store entrypoint-specific cache payloads BEFORE an autofix
        run has been started, thus requires a group_id. When an autofix run does start, Seer emits a
        webhook with the run_id and group_id, so we can relocate the cache to the post-autofix key.
        """
        return f"seer:pre_autofix:{entrypoint_key}:{group_id}"

    @classmethod
    def get_post_autofix_cache_key(cls, *, entrypoint_key: str, run_id: int) -> str:
        """
        The autofix cache key is used to store entrypoint-specific cache payloads AFTER an autofix
        run has been started, thus requires a run_id.
        """
        return f"seer:post_autofix:{entrypoint_key}:{run_id}"

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
                payload = AutofixSelectRootCausePayload(
                    type="select_root_cause",
                    cause_id=0,
                    # XXX: Continue from solution to code changes automatically.
                    stopping_point=AutofixStoppingPoint.CODE_CHANGES.value,
                )
            elif stopping_point == AutofixStoppingPoint.CODE_CHANGES:
                payload = AutofixSelectSolutionPayload(type="select_solution")
            elif stopping_point == AutofixStoppingPoint.OPEN_PR:
                payload = AutofixCreatePRPayload(type="create_pr")
            else:
                logger.warning("operator.invalid_stopping_point", extra=self.logging_ctx)
                self.entrypoint.on_trigger_autofix_error(error="Invalid stopping point provided")
                return

            raw_response = update_autofix(
                organization_id=group.organization.id, run_id=run_id, payload=payload
            )

        # Type-safety...
        assert raw_response is not None

        error_message = raw_response.data.get("detail")

        # Let the entrypoint signal to the external service that no run was started :/
        if error_message:
            self.logging_ctx["error_message"] = error_message
            logger.warning("operator.trigger_autofix_error", extra=self.logging_ctx)
            self.entrypoint.on_trigger_autofix_error(error=error_message)
            return

        run_id = raw_response.data.get("run_id") if not run_id else run_id
        # Shouldn't ever happen, but if it we have no run_id, we can't listen for updates
        if not run_id:
            logger.warning("operator.trigger_autofix_no_run_id", extra=self.logging_ctx)
            self.entrypoint.on_trigger_autofix_error(error="An unknown error has occurred")
            return

        # Let the entrypoint signal to the external service that the run started
        self.entrypoint.on_trigger_autofix_success(run_id=run_id)

        # Create a cache payload that will be picked up for subsequent updates
        cache_payload = self.entrypoint.create_autofix_cache_payload()

        if cache_payload:
            cache_key = SeerOperator.populate_autofix_cache(
                entrypoint_key=str(self.entrypoint.key),
                cache_payload=cache_payload,
                run_id=run_id,
            )
            self.logging_ctx["cache_key"] = cache_key
        logger.info("operator.trigger_autofix_success", extra=self.logging_ctx)

    @staticmethod
    def populate_autofix_cache(
        *,
        entrypoint_key: str,
        cache_payload: CachePayloadT,
        group_id: int | None = None,
        run_id: int | None = None,
    ) -> str:
        if (not group_id and not run_id) or (group_id and run_id):
            raise ValueError("Either group_id or run_id must be provided, but not both.")

        if group_id:
            cache_key = SeerOperator.get_pre_autofix_cache_key(
                entrypoint_key=entrypoint_key, group_id=group_id
            )
        else:
            # mypy can't interpret the first conditional, so we assert here.
            assert run_id is not None
            cache_key = SeerOperator.get_post_autofix_cache_key(
                entrypoint_key=entrypoint_key, run_id=run_id
            )

        cache.set(cache_key, cache_payload, timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS)
        return cache_key

    @staticmethod
    def migrate_autofix_cache(
        *,
        group_id: int,
        run_id: int,
        overwrite: bool = False,
    ) -> None:
        """
        Migrate from a pre-autofix cache (keyed on group_id) to a post-autofix cache (keyed on run_id),
        if one exists. If overwrite is True, any existing post-autofix cache will be overwritten.
        """
        for entrypoint_key in entrypoint_registry.registrations.keys():
            pre_cache_key = SeerOperator.get_pre_autofix_cache_key(
                entrypoint_key=entrypoint_key, group_id=group_id
            )
            pre_cache_payload = cache.get(pre_cache_key)
            post_cache_key = SeerOperator.get_post_autofix_cache_key(
                entrypoint_key=entrypoint_key, run_id=run_id
            )
            post_cache_payload = cache.get(post_cache_key)
            if not overwrite and post_cache_payload:
                continue
            if not pre_cache_payload:
                continue
            cache.set(post_cache_key, pre_cache_payload, timeout=AUTOFIX_CACHE_TIMEOUT_SECONDS)


@instrumented_task(
    name="sentry.seer.entrypoints.operator.process_autofix_updates",
    namespace=seer_tasks,
    processing_deadline_duration=PROCESS_AUTOFIX_TIMEOUT_SECONDS,
    retry=None,
)
def process_autofix_updates(
    *, event_type: SentryAppEventType, event_payload: dict[str, Any]
) -> None:
    """
    Use the registry to iterate over all entrypoints and check if this payload's run_id or group_id
    has a cache. If so, call the entrypoint's handler with the payload it had previously cached.
    """

    run_id = event_payload.get("run_id")
    group_id = event_payload.get("group_id")
    logging_ctx = {"event_type": event_type, "run_id": run_id, "group_id": group_id}

    if not run_id and not group_id:
        logger.warning("operator.missing_identifiers", extra=logging_ctx)
        return

    if event_type not in SEER_OPERATOR_AUTOFIX_UPDATE_EVENTS:
        logger.info("operator.skipping_update", extra=logging_ctx)
        return

    for entrypoint_key, entrypoint_cls in entrypoint_registry.registrations.items():
        group_cache_payload = None
        run_cache_payload = None
        if group_id:
            pre_cache_key = SeerOperator.get_pre_autofix_cache_key(
                entrypoint_key=entrypoint_key, group_id=group_id
            )
            logging_ctx["pre_cache_key"] = pre_cache_key
            group_cache_payload = cache.get(pre_cache_key)
        if run_id:
            post_cache_key = SeerOperator.get_post_autofix_cache_key(
                entrypoint_key=entrypoint_key, run_id=run_id
            )
            logging_ctx["post_cache_key"] = post_cache_key
            run_cache_payload = cache.get(post_cache_key)

        # We prefer the run cache payload since it's more narrow
        # A group can have multiple runs, and that means many threads to post updates to.
        # A run has a single group, and (usually) a single thread to post updates to.
        cache_payload = run_cache_payload or group_cache_payload
        if not cache_payload:
            logger.info("operator.no_cache_payload", extra=logging_ctx)
            continue
        try:
            entrypoint_cls.on_autofix_update(
                event_type=event_type, event_payload=event_payload, cache_payload=cache_payload
            )
        except Exception:
            logger.exception("operator.on_autofix_update_error", extra=logging_ctx)
        else:
            logger.info("operator.on_autofix_update_success", extra=logging_ctx)
