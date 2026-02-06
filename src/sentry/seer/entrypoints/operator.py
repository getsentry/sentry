import logging
from typing import Any

from rest_framework.response import Response

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.autofix.autofix import trigger_autofix as _trigger_autofix
from sentry.seer.autofix.autofix import update_autofix
from sentry.seer.autofix.types import (
    AutofixCreatePRPayload,
    AutofixSelectRootCausePayload,
    AutofixSelectSolutionPayload,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.cache import SeerOperatorAutofixCache
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.seer.seer_setup import has_seer_access
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import metrics

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
    def has_access(
        cls, *, organization: Organization, entrypoint_key: SeerEntrypointKey | None = None
    ) -> bool:
        """
        Checks if the organization has access to Seer, and atleast one entrypoint.
        If an entrypoint_key is provided, ensures the organization has access to that entrypoint.
        """
        if not has_seer_access(organization):
            return False

        if entrypoint_key:
            if entrypoint_key not in entrypoint_registry.registrations:
                logger.error(
                    "seer.operator.invalid_entrypoint_key",
                    extra={
                        "entrypoint_key": str(entrypoint_key),
                        "organization_id": organization.id,
                    },
                )
                return False
            entrypoint_cls = entrypoint_registry.registrations[entrypoint_key]
            return entrypoint_cls.has_access(organization)

        return any(
            entrypoint_cls.has_access(organization=organization)
            for entrypoint_cls in entrypoint_registry.registrations.values()
        )

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
        self.logging_ctx["stopping_point"] = str(stopping_point)
        metric_tags = {
            "stopping_point": str(stopping_point),
            "entrypoint_key": str(self.entrypoint.key),
            "is_continuation": str(run_id is not None),
        }

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
                logger.error(
                    "seer.operator.trigger_autofix.invalid_stopping_point", extra=self.logging_ctx
                )
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
            logger.error("seer.operator.trigger_autofix.error", extra=self.logging_ctx)
            metrics.incr("seer.operator.trigger_autofix.error", tags=metric_tags)
            self.entrypoint.on_trigger_autofix_error(error=error_message)
            return

        run_id = raw_response.data.get("run_id") if not run_id else run_id
        # Shouldn't ever happen, but if it we have no run_id, we can't listen for updates
        if not run_id:
            logger.error("seer.operator.trigger_autofix.no_run_id", extra=self.logging_ctx)
            self.entrypoint.on_trigger_autofix_error(error="An unknown error has occurred")
            return
        self.logging_ctx["run_id"] = str(run_id)

        # Let the entrypoint signal to the external service that the run started
        self.entrypoint.on_trigger_autofix_success(run_id=run_id)

        # Create a cache payload that will be picked up for subsequent updates
        cache_payload = self.entrypoint.create_autofix_cache_payload()

        if cache_payload:
            cache_result = SeerOperatorAutofixCache.populate_post_autofix_cache(
                entrypoint_key=str(self.entrypoint.key),
                cache_payload=cache_payload,
                run_id=run_id,
            )
            self.logging_ctx["cache_key"] = cache_result["key"]
        logger.info("seer.operator.trigger_autofix.success", extra=self.logging_ctx)
        metrics.incr("seer.operator.trigger_autofix.success", tags=metric_tags)


@instrumented_task(
    name="sentry.seer.entrypoints.operator.process_autofix_updates",
    namespace=seer_tasks,
    processing_deadline_duration=PROCESS_AUTOFIX_TIMEOUT_SECONDS,
    retry=None,
)
def process_autofix_updates(
    *, event_type: SentryAppEventType, event_payload: dict[str, Any], organization_id: int
) -> None:
    """
    Use the registry to iterate over all entrypoints and check if this payload's run_id or group_id
    has a cache. If so, call the entrypoint's handler with the payload it had previously cached.
    """

    run_id = event_payload.get("run_id")
    group_id = event_payload.get("group_id")
    logging_ctx = {
        "event_type": str(event_type),
        "run_id": run_id,
        "group_id": group_id,
        "organization_id": organization_id,
    }

    if not run_id or not group_id:
        logger.error("seer.operator.process_updates.missing_identifiers", extra=logging_ctx)
        return

    if event_type not in SEER_OPERATOR_AUTOFIX_UPDATE_EVENTS:
        logger.info("seer.operator.process_updates.skipped", extra=logging_ctx)
        return

    try:
        Group.objects.get(id=group_id, project__organization_id=organization_id)
    except Group.DoesNotExist:
        logger.exception("seer.operator.process_updates.group_not_found", extra=logging_ctx)
        return

    for entrypoint_key, entrypoint_cls in entrypoint_registry.registrations.items():
        entrypoint_logging_ctx = {**logging_ctx, "entrypoint_key": str(entrypoint_key)}
        cache_result = SeerOperatorAutofixCache.get(
            entrypoint_key=entrypoint_key, group_id=group_id, run_id=run_id
        )
        if not cache_result:
            logger.info("seer.operator.process_updates.cache_miss", extra=entrypoint_logging_ctx)
            continue
        entrypoint_logging_ctx["cache_source"] = cache_result["source"]
        entrypoint_logging_ctx["cache_key"] = cache_result["key"]
        metric_tags = {"entrypoint_key": str(entrypoint_key), "event_type": str(event_type)}
        try:
            entrypoint_cls.on_autofix_update(
                event_type=event_type,
                event_payload=event_payload,
                cache_payload=cache_result["payload"],
            )
        except Exception:
            logger.exception(
                "seer.operator.process_updates.entrypoint_error", extra=entrypoint_logging_ctx
            )
            metrics.incr("seer.operator.process_updates.entrypoint_error", tags=metric_tags)
        else:
            logger.info(
                "seer.operator.process_updates.entrypoint_success", extra=entrypoint_logging_ctx
            )
            metrics.incr("seer.operator.process_updates.entrypoint_success", tags=metric_tags)
