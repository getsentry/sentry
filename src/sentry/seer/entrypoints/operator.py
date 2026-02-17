import logging
from typing import Any

from rest_framework.response import Response

from sentry import features
from sentry.constants import DataCategory
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.autofix.autofix import trigger_autofix as _trigger_autofix
from sentry.seer.autofix.autofix import update_autofix
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.types import (
    AutofixCreatePRPayload,
    AutofixSelectRootCausePayload,
    AutofixSelectSolutionPayload,
)
from sentry.seer.autofix.utils import (
    AutofixState,
    AutofixStoppingPoint,
    get_autofix_state,
)
from sentry.seer.entrypoints.cache import SeerOperatorAutofixCache
from sentry.seer.entrypoints.metrics import (
    SeerOperatorEventLifecycleMetric,
    SeerOperatorInteractionType,
)
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.seer.seer_setup import has_seer_access
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser

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
AUTOFIX_FALLBACK_CAUSE_ID = 0


class SeerOperator[CachePayloadT]:
    """
    A class that connects to entrypoint implementations and runs operations for Seer with them.
    It does this to ensure all entrypoints have consistent behavior and responses.
    """

    def __init__(self, entrypoint: SeerEntrypoint[CachePayloadT]):
        self.entrypoint = entrypoint

    @classmethod
    def has_access(
        cls,
        *,
        organization: Organization,
        entrypoint_key: SeerEntrypointKey | None = None,
    ) -> bool:
        """
        Checks if the organization has access to Seer, and atleast one entrypoint.
        If an entrypoint_key is provided, ensures the organization has access to that entrypoint.
        """
        if not has_seer_access(organization):
            return False

        # Currently, this feature is built around legacy autofix
        # The explorer autofix pipeline and history is entirely separate, so the runs we trigger
        # at the moment, won't be visible in-app to users with this flag.
        # This check can only be removed once this feature migrates to explorer-based autofix.
        if features.has("organizations:autofix-on-explorer", organization):
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

    @classmethod
    def can_trigger_autofix(cls, *, group: Group) -> bool:
        """
        Checks if a group is permitted to trigger autofix.
        Validates Seer access for the organization, the issue category, and autofix quota.
        """
        from sentry import quotas
        from sentry.seer.autofix.utils import is_issue_category_eligible
        from sentry.seer.seer_setup import has_seer_access

        return (
            has_seer_access(group.organization)
            and is_issue_category_eligible(group)
            and quotas.backend.check_seer_quota(
                org_id=group.organization.id,
                data_category=DataCategory.SEER_AUTOFIX,
            )
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
        event_lifecyle = SeerOperatorEventLifecycleMetric(
            interaction_type=SeerOperatorInteractionType.OPERATOR_TRIGGER_AUTOFIX,
            entrypoint_key=self.entrypoint.key,
        )

        raw_response: Response | None = None
        with event_lifecyle.capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "group_id": str(group.id),
                    "user_id": str(user.id),
                    "stopping_point": str(stopping_point),
                }
            )
            try:
                existing_state = get_autofix_state(
                    group_id=group.id, organization_id=group.organization.id
                )
            except Exception as e:
                with SeerOperatorEventLifecycleMetric(
                    interaction_type=SeerOperatorInteractionType.ENTRYPOINT_ON_TRIGGER_AUTOFIX_ERROR,
                    entrypoint_key=self.entrypoint.key,
                ).capture():
                    self.entrypoint.on_trigger_autofix_error(
                        error="Encountered an error while talking to Seer"
                    )
                lifecycle.record_failure(failure_reason=e)
                return
            if existing_state:
                stopping_point_step = get_stopping_point_status(stopping_point, existing_state)
                lifecycle.add_extras(
                    {
                        "existing_run_id": str(existing_state.run_id),
                        "existing_run_status": str(existing_state.status),
                    }
                )
                # For now, we don't support re-runs over slack -- it causes a confusing UX without
                # reliably being able to edit messages.
                if stopping_point_step:
                    with SeerOperatorEventLifecycleMetric(
                        interaction_type=SeerOperatorInteractionType.ENTRYPOINT_ON_TRIGGER_AUTOFIX_ALREADY_EXISTS,
                        entrypoint_key=self.entrypoint.key,
                    ).capture():
                        self.entrypoint.on_trigger_autofix_already_exists(
                            state=existing_state, step_state=stopping_point_step
                        )
                    return

            if not run_id:
                raw_response = _trigger_autofix(
                    group=group,
                    user=user,
                    referrer=AutofixReferrer.SLACK,
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
                    payload = AutofixSelectRootCausePayload(
                        type="select_root_cause",
                        cause_id=get_latest_cause_id(existing_state),
                    )
                elif stopping_point == AutofixStoppingPoint.CODE_CHANGES:
                    payload = AutofixSelectSolutionPayload(type="select_solution")
                elif stopping_point == AutofixStoppingPoint.OPEN_PR:
                    payload = AutofixCreatePRPayload(type="create_pr")
                else:
                    lifecycle.record_failure(failure_reason="invalid_stopping_point")
                    with SeerOperatorEventLifecycleMetric(
                        interaction_type=SeerOperatorInteractionType.ENTRYPOINT_ON_TRIGGER_AUTOFIX_ERROR,
                        entrypoint_key=self.entrypoint.key,
                    ).capture():
                        self.entrypoint.on_trigger_autofix_error(
                            error="Invalid stopping point provided"
                        )
                    return

                raw_response = update_autofix(
                    organization_id=group.organization.id,
                    run_id=run_id,
                    payload=payload,
                )

            error_message = raw_response.data.get("detail")

            # Let the entrypoint signal to the external service that no run was started :/
            if error_message:
                lifecycle.record_failure(failure_reason=error_message)
                with SeerOperatorEventLifecycleMetric(
                    interaction_type=SeerOperatorInteractionType.ENTRYPOINT_ON_TRIGGER_AUTOFIX_ERROR,
                    entrypoint_key=self.entrypoint.key,
                ).capture():
                    self.entrypoint.on_trigger_autofix_error(error=error_message)
                return

            run_id = raw_response.data.get("run_id") if not run_id else run_id
            if not run_id:
                lifecycle.record_failure(failure_reason="no_run_id")
                with SeerOperatorEventLifecycleMetric(
                    interaction_type=SeerOperatorInteractionType.ENTRYPOINT_ON_TRIGGER_AUTOFIX_ERROR,
                    entrypoint_key=self.entrypoint.key,
                ).capture():
                    self.entrypoint.on_trigger_autofix_error(error="An unknown error has occurred")
                return
            lifecycle.add_extra("run_id", str(run_id))

            # Let the entrypoint signal to the external service that the run started
            with SeerOperatorEventLifecycleMetric(
                interaction_type=SeerOperatorInteractionType.ENTRYPOINT_ON_TRIGGER_AUTOFIX_SUCCESS,
                entrypoint_key=self.entrypoint.key,
            ).capture():
                self.entrypoint.on_trigger_autofix_success(run_id=run_id)

            # Create a cache payload that will be picked up for subsequent updates
            with SeerOperatorEventLifecycleMetric(
                interaction_type=SeerOperatorInteractionType.ENTRYPOINT_CREATE_AUTOFIX_CACHE_PAYLOAD,
                entrypoint_key=self.entrypoint.key,
            ).capture():
                cache_payload = self.entrypoint.create_autofix_cache_payload()

            if not cache_payload:
                return
            cache_result = SeerOperatorAutofixCache.populate_post_autofix_cache(
                entrypoint_key=str(self.entrypoint.key),
                cache_payload=cache_payload,
                run_id=run_id,
            )
            lifecycle.add_extras(
                {
                    "cache_key": cache_result["key"],
                    "cache_source": cache_result["source"],
                }
            )


@instrumented_task(
    name="sentry.seer.entrypoints.operator.process_autofix_updates",
    namespace=seer_tasks,
    processing_deadline_duration=PROCESS_AUTOFIX_TIMEOUT_SECONDS,
    retry=None,
)
def process_autofix_updates(
    *,
    event_type: SentryAppEventType,
    event_payload: dict[str, Any],
    organization_id: int,
) -> None:
    """
    Use the registry to iterate over all entrypoints and check if this payload's run_id or group_id
    has a cache. If so, call the entrypoint's handler with the payload it had previously cached.
    """
    with SeerOperatorEventLifecycleMetric(
        interaction_type=SeerOperatorInteractionType.OPERATOR_PROCESS_AUTOFIX_UPDATE
    ).capture() as lifecycle:
        run_id = event_payload.get("run_id")
        group_id = event_payload.get("group_id")
        lifecycle.add_extras(
            {
                "group_id": str(group_id),
                "run_id": str(run_id),
                "organization_id": organization_id,
                "event_type": str(event_type),
            }
        )

        if not run_id or not group_id:
            lifecycle.record_failure(failure_reason="missing_identifiers")
            return

        if event_type not in SEER_OPERATOR_AUTOFIX_UPDATE_EVENTS:
            lifecycle.record_halt(halt_reason="skipped")
            return

        try:
            Group.objects.get(id=group_id, project__organization_id=organization_id)
        except Group.DoesNotExist:
            lifecycle.record_failure(failure_reason="group_not_found")
            return

        for entrypoint_key, entrypoint_cls in entrypoint_registry.registrations.items():
            cache_result = SeerOperatorAutofixCache.get(
                entrypoint_key=entrypoint_key, group_id=group_id, run_id=run_id
            )
            if not cache_result:
                continue
            with SeerOperatorEventLifecycleMetric(
                interaction_type=SeerOperatorInteractionType.ENTRYPOINT_ON_AUTOFIX_UPDATE,
                entrypoint_key=entrypoint_key,
            ).capture() as ept_lifecycle:
                # We need to wrap here so that no one entrypoint failure can fail the whole task
                try:
                    entrypoint_cls.on_autofix_update(
                        event_type=event_type,
                        event_payload=event_payload,
                        cache_payload=cache_result["payload"],
                    )
                except Exception as e:
                    ept_lifecycle.record_failure(failure_reason=e)


def get_stopping_point_status(
    stopping_point: AutofixStoppingPoint, autofix_state: AutofixState
) -> dict | None:
    """
    Gets the most recent matching step state from a given stopping point.
    """
    # The most recent of a repeated step is at the end of the list, that's what we want to surface
    steps = reversed(autofix_state.steps)
    match stopping_point:
        case AutofixStoppingPoint.ROOT_CAUSE:
            step = next(
                (
                    step
                    for step in steps
                    if step.get("key") in {"root_cause_analysis", "root_cause_analysis_processing"}
                ),
                None,
            )
        case AutofixStoppingPoint.SOLUTION:
            step = next(
                (step for step in steps if step.get("key") in {"solution", "solution_processing"}),
                None,
            )
        case AutofixStoppingPoint.CODE_CHANGES:
            step = next((step for step in steps if step.get("key") == "changes"), None)
        case AutofixStoppingPoint.OPEN_PR:
            step = next(
                (
                    step
                    for step in steps
                    if step.get("key") == "changes"
                    and any(change.get("pull_request") for change in step.get("changes", []))
                ),
                None,
            )
    return step


def get_latest_cause_id(autofix_state: AutofixState | None) -> int:
    """
    Gets the latest cause_id from a given autofix state.
    """
    if not autofix_state:
        return AUTOFIX_FALLBACK_CAUSE_ID
    root_cause_step = next(
        (
            step
            # If there are multiple RCA steps, we want the latest, so we reverse the list
            for step in reversed(autofix_state.steps)
            if step.get("key") == "root_cause_analysis"
        ),
        None,
    )
    if not root_cause_step:
        return AUTOFIX_FALLBACK_CAUSE_ID

    root_causes = root_cause_step.get("causes", [])
    if not root_causes:
        return AUTOFIX_FALLBACK_CAUSE_ID

    # The most recent cause is at the end of the list
    return root_causes[-1].get("id", AUTOFIX_FALLBACK_CAUSE_ID)
