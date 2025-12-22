from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import orjson
import requests
import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry import features, quotas
from sentry.api.serializers import EventSerializer, serialize
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.constants import DataCategory
from sentry.locks import locks
from sentry.models.group import Group
from sentry.net.http import connection_from_url
from sentry.seer.autofix.autofix import _get_trace_tree_for_event, trigger_autofix
from sentry.seer.autofix.autofix_agent import AutofixStep, trigger_autofix_explorer
from sentry.seer.autofix.constants import (
    AutofixAutomationTuningSettings,
    FixabilityScoreThresholds,
    SeerAutomationSource,
)
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    get_autofix_state,
    is_seer_autotriggered_autofix_rate_limited,
    is_seer_seat_based_tier_enabled,
)
from sentry.seer.models import SummarizeIssueResponse
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.seer.signed_seer_api import make_signed_seer_api_request, sign_with_seer_secret
from sentry.services import eventstore
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.taskworker.retry import Retry
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

auto_run_source_map = {
    SeerAutomationSource.ISSUE_DETAILS: "issue_summary_fixability",
    SeerAutomationSource.ALERT: "issue_summary_on_alert_fixability",
    SeerAutomationSource.POST_PROCESS: "issue_summary_on_post_process_fixability",
}

STOPPING_POINT_HIERARCHY = {
    AutofixStoppingPoint.ROOT_CAUSE: 1,
    AutofixStoppingPoint.SOLUTION: 2,
    AutofixStoppingPoint.CODE_CHANGES: 3,
    AutofixStoppingPoint.OPEN_PR: 4,
}


def _get_stopping_point_from_fixability(fixability_score: float) -> AutofixStoppingPoint | None:
    """
    Determine the autofix stopping point based on fixability score.
    """
    if fixability_score < FixabilityScoreThresholds.MEDIUM.value:
        return None
    elif fixability_score < FixabilityScoreThresholds.HIGH.value:
        return AutofixStoppingPoint.ROOT_CAUSE
    # 0.76 + 0.02 - extra buffer to avoid opening too many PRs.
    elif fixability_score < FixabilityScoreThresholds.SUPER_HIGH.value + 0.02:
        return AutofixStoppingPoint.CODE_CHANGES
    else:
        return AutofixStoppingPoint.OPEN_PR


def _fetch_user_preference(project_id: int) -> str | None:
    """
    Fetch the user's automated_run_stopping_point preference from Seer.
    Returns None if preference is not set or if the API call fails.
    """
    try:
        path = "/v1/project-preference"
        body = orjson.dumps({"project_id": project_id})

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
            timeout=5,
        )
        response.raise_for_status()

        result = response.json()
        preference = result.get("preference")
        if preference:
            return preference.get("automated_run_stopping_point")
        return None
    except Exception as e:
        sentry_sdk.set_context("project", {"project_id": project_id})
        sentry_sdk.capture_exception(e)
        return None


def _apply_user_preference_upper_bound(
    fixability_suggestion: AutofixStoppingPoint | None,
    user_preference: str | None,
) -> AutofixStoppingPoint:
    """
    Apply user preference as an upper bound on the fixability-based stopping point.
    Returns the more conservative (earlier) stopping point between the two.
    """
    # If fixability is None but user preference exists, use user preference
    if fixability_suggestion is None and user_preference is not None:
        return AutofixStoppingPoint(user_preference)
    # If fixability exists but user preference is None, use fixability
    elif fixability_suggestion is not None and user_preference is None:
        return fixability_suggestion
    # If both are None, return ROOT_CAUSE as default
    elif fixability_suggestion is None and user_preference is None:
        return AutofixStoppingPoint.ROOT_CAUSE
    # Both are not None - return the more conservative one
    else:
        assert fixability_suggestion is not None and user_preference is not None  # for mypy
        user_stopping_point = AutofixStoppingPoint(user_preference)
        return (
            fixability_suggestion
            if STOPPING_POINT_HIERARCHY[fixability_suggestion]
            <= STOPPING_POINT_HIERARCHY[user_stopping_point]
            else user_stopping_point
        )


@instrumented_task(
    name="sentry.tasks.autofix.trigger_autofix_from_issue_summary",
    namespace=seer_tasks,
    processing_deadline_duration=65,
    retry=Retry(times=1),
)
def _trigger_autofix_task(
    group_id: int,
    event_id: str,
    user_id: int | None,
    auto_run_source: str,
    stopping_point: AutofixStoppingPoint | None = None,
):
    """
    Asynchronous task to trigger Autofix.
    """
    with sentry_sdk.start_span(op="ai_summary.trigger_autofix"):
        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            logger.warning("_trigger_autofix_task.group_not_found", extra={"group_id": group_id})
            return

        user: User | AnonymousUser | RpcUser | None = None
        if user_id:
            user = user_service.get_user(user_id=user_id)
            if user is None:
                logger.warning(
                    "_trigger_autofix_task.user_not_found",
                    extra={"group_id": group_id, "user_id": user_id},
                )
                user = AnonymousUser()
        else:
            user = AnonymousUser()

        # Route to explorer-based autofix if both feature flags are enabled
        if features.has("organizations:seer-explorer", group.organization) and features.has(
            "organizations:autofix-on-explorer", group.organization
        ):
            trigger_autofix_explorer(
                group=group,
                step=AutofixStep.ROOT_CAUSE,
                run_id=None,
                stopping_point=stopping_point,
            )
        else:
            trigger_autofix(
                group=group,
                event_id=event_id,
                user=user,
                auto_run_source=auto_run_source,
                stopping_point=stopping_point,
            )


def _get_event(
    group: Group,
    user: User | RpcUser | AnonymousUser,
    provided_event_id: str | None = None,
) -> tuple[dict[str, Any] | None, GroupEvent | None]:
    event = None
    if provided_event_id:
        provided_event = eventstore.backend.get_event_by_id(
            group.project.id, provided_event_id, group_id=group.id
        )
        if provided_event:
            if isinstance(provided_event, Event):
                provided_event = provided_event.for_group(group)
            event = provided_event
    else:
        event = group.get_recommended_event_for_environments()
    if not event:
        event = group.get_latest_event()

    if not event:
        return None, None

    event_id = event.event_id

    ready_event = eventstore.backend.get_event_by_id(group.project.id, event_id, group_id=group.id)

    if not ready_event:
        return None, None

    return serialize(ready_event, user, EventSerializer()), event


def _call_seer(
    group: Group,
    serialized_event: dict[str, Any],
    trace_tree: dict[str, Any] | None,
):
    path = "/v1/automation/summarize/issue"
    body = orjson.dumps(
        {
            "group_id": group.id,
            "issue": {
                "id": group.id,
                "title": group.title,
                "short_id": group.qualified_short_id,
                "events": [serialized_event],
            },
            "trace_tree": trace_tree,
            "organization_slug": group.organization.slug,
            "organization_id": group.organization.id,
            "project_id": group.project.id,
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    # Route to summarization URL
    response = requests.post(
        f"{settings.SEER_SUMMARIZATION_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
        timeout=30,
    )
    response.raise_for_status()

    return SummarizeIssueResponse.validate(response.json())


fixability_connection_pool_gpu = connection_from_url(
    settings.SEER_SCORING_URL,
    timeout=settings.SEER_FIXABILITY_TIMEOUT,
)


def _generate_fixability_score(
    group: Group,
    summary: dict[str, Any] | None = None,
) -> SummarizeIssueResponse:
    payload: dict[str, Any] = {
        "group_id": group.id,
        "organization_slug": group.organization.slug,
        "organization_id": group.organization.id,
        "project_id": group.project.id,
    }
    if summary is not None:
        payload["summary"] = summary
    response = make_signed_seer_api_request(
        fixability_connection_pool_gpu,
        "/v1/automation/summarize/fixability",
        body=orjson.dumps(payload, option=orjson.OPT_NON_STR_KEYS),
        timeout=settings.SEER_FIXABILITY_TIMEOUT,
    )
    if response.status >= 400:
        raise Exception(f"Seer API error: {response.status}")
    response_data = orjson.loads(response.data)
    return SummarizeIssueResponse.validate(response_data)


def get_and_update_group_fixability_score(
    group: Group,
    force_generate: bool = False,
    summary: dict[str, Any] | None = None,
) -> float:
    """
    Get the fixability score for a group and update the group with the score.
    If the fixability score is already set, return it without generating a new one.
    """
    if not force_generate and group.seer_fixability_score is not None:
        return group.seer_fixability_score

    with sentry_sdk.start_span(op="ai_summary.generate_fixability_score"):
        issue_summary = _generate_fixability_score(group, summary=summary)

    if not issue_summary.scores:
        raise ValueError("Issue summary scores is None or empty.")
    if issue_summary.scores.fixability_score is None:
        raise ValueError("Issue summary fixability score is None.")

    fixability_score = issue_summary.scores.fixability_score
    group.update(seer_fixability_score=fixability_score)
    return fixability_score


def _is_issue_fixable(group: Group, fixability_score: float) -> bool:
    project = group.project
    option = project.get_option("sentry:autofix_automation_tuning")
    if option == AutofixAutomationTuningSettings.OFF:
        return False
    elif option == AutofixAutomationTuningSettings.SUPER_LOW:
        return fixability_score >= FixabilityScoreThresholds.SUPER_HIGH.value
    elif option == AutofixAutomationTuningSettings.LOW:
        return fixability_score >= FixabilityScoreThresholds.HIGH.value
    elif option == AutofixAutomationTuningSettings.MEDIUM:
        return fixability_score >= FixabilityScoreThresholds.MEDIUM.value
    elif option == AutofixAutomationTuningSettings.HIGH:
        return fixability_score >= FixabilityScoreThresholds.LOW.value
    elif option == AutofixAutomationTuningSettings.ALWAYS:
        return True
    return False


def run_automation(
    group: Group,
    user: User | RpcUser | AnonymousUser,
    event: GroupEvent,
    source: SeerAutomationSource,
) -> None:
    if source == SeerAutomationSource.ISSUE_DETAILS:
        return

    # Check event count for ALERT source with triage-signals-v0-org
    if is_seer_seat_based_tier_enabled(group.organization):
        if source == SeerAutomationSource.ALERT:
            # Use times_seen_with_pending if available (set by post_process), otherwise fall back
            times_seen = (
                group.times_seen_with_pending
                if hasattr(group, "_times_seen_pending")
                else group.times_seen
            )
            if times_seen < 10:
                return

        try:
            times_seen = group.times_seen_with_pending
        except (AssertionError, AttributeError):
            times_seen = group.times_seen
        logger.info(
            "Triage signals V0: %s: run_automation called: project_slug=%s, source=%s, times_seen=%s",
            group.id,
            group.project.slug,
            source.value,
            times_seen,
        )

    user_id = user.id if user else None
    auto_run_source = auto_run_source_map.get(source, "unknown_source")

    sentry_sdk.set_tags(
        {
            "group_id": group.id,
            "user_id": user_id,
            "auto_run_source": auto_run_source,
            "org_slug": group.organization.slug,
            "org_id": group.organization.id,
            "project_id": group.project.id,
        }
    )

    # Only generate fixability if it doesn't already exist
    fixability_score = get_and_update_group_fixability_score(group)

    if (
        not _is_issue_fixable(group, fixability_score)
        and not group.issue_type.always_trigger_seer_automation
    ):
        return

    has_budget: bool = quotas.backend.check_seer_quota(
        org_id=group.organization.id,
        data_category=DataCategory.SEER_AUTOFIX,
    )
    if not has_budget:
        return

    autofix_state = get_autofix_state(group_id=group.id, organization_id=group.organization.id)
    if autofix_state:
        return  # already have an autofix on this issue

    is_rate_limited = is_seer_autotriggered_autofix_rate_limited(group.project, group.organization)
    if is_rate_limited:
        return

    stopping_point = None
    if is_seer_seat_based_tier_enabled(group.organization):
        fixability_stopping_point = _get_stopping_point_from_fixability(fixability_score)

        # Fetch user preference and apply as upper bound
        user_preference = _fetch_user_preference(group.project.id)

        stopping_point = _apply_user_preference_upper_bound(
            fixability_stopping_point, user_preference
        )

    _trigger_autofix_task.delay(
        group_id=group.id,
        event_id=event.event_id,
        user_id=user_id,
        auto_run_source=auto_run_source,
        stopping_point=stopping_point,
    )


def _generate_summary(
    group: Group,
    user: User | RpcUser | AnonymousUser,
    force_event_id: str | None,
    source: SeerAutomationSource,
    cache_key: str,
    should_run_automation: bool = True,
) -> tuple[dict[str, Any], int]:
    """Core logic to generate and cache the issue summary."""
    serialized_event, event = _get_event(group, user, provided_event_id=force_event_id)

    if not serialized_event or not event:
        return {"detail": "Could not find an event for the issue"}, 400

    trace_tree = None
    if event:
        try:
            trace_tree = _get_trace_tree_for_event(event, group.project, timeout=3)
        except Exception:
            logger.warning(
                "Failed to get trace for event in issue summary",
                extra={"group_id": group.id},
                exc_info=True,
            )

    issue_summary = _call_seer(
        group,
        serialized_event,
        trace_tree,
    )

    if should_run_automation:
        try:
            run_automation(group, user, event, source)
        except Exception:
            logger.exception(
                "Error auto-triggering autofix from issue summary", extra={"group_id": group.id}
            )

    summary_dict = issue_summary.dict()
    summary_dict["event_id"] = event.event_id

    cache.set(cache_key, summary_dict, timeout=int(timedelta(days=7).total_seconds()))

    return summary_dict, 200


def _log_seer_scanner_billing_event(group: Group, source: SeerAutomationSource):
    if source == SeerAutomationSource.ISSUE_DETAILS:
        return

    quotas.backend.record_seer_run(
        group.organization.id, group.project.id, DataCategory.SEER_SCANNER
    )


def get_issue_summary_cache_key(group_id: int) -> str:
    return f"ai-group-summary-v2:{group_id}"


def get_issue_summary_lock_key(group_id: int) -> tuple[str, str]:
    return (f"ai-group-summary-v2-lock:{group_id}", "get_issue_summary")


def get_issue_summary(
    group: Group,
    user: User | RpcUser | AnonymousUser | None = None,
    force_event_id: str | None = None,
    source: SeerAutomationSource = SeerAutomationSource.ISSUE_DETAILS,
    should_run_automation: bool = True,
) -> tuple[dict[str, Any], int]:
    """
    Generate an AI summary for an issue.

    Args:
        group: The issue group
        user: The user requesting the summary
        force_event_id: Optional event ID to force summarizing a specific event
        source: The source triggering the summary generation
        should_run_automation: Whether to trigger automation after generating summary

    Returns:
        A tuple containing (summary_data, status_code)
    """
    if user is None:
        user = AnonymousUser()
    if not features.has("organizations:gen-ai-features", group.organization, actor=user):
        return {"detail": "Feature flag not enabled"}, 400

    if group.organization.get_option("sentry:hide_ai_features"):
        return {"detail": "AI features are disabled for this organization."}, 403

    if not get_seer_org_acknowledgement(group.organization):
        return {"detail": "AI Autofix has not been acknowledged by the organization."}, 403

    cache_key = get_issue_summary_cache_key(group.id)
    lock_key, lock_name = get_issue_summary_lock_key(group.id)
    lock_duration = 40  # How long the lock is held if acquired (seconds). request timeout is 30 sec
    wait_timeout = 4.5  # How long to wait for the lock (seconds)

    # if force_event_id is set, we always generate a new summary
    if force_event_id:
        summary_dict, status_code = _generate_summary(
            group, user, force_event_id, source, cache_key, should_run_automation
        )
        _log_seer_scanner_billing_event(group, source)
        return convert_dict_key_case(summary_dict, snake_to_camel_case), status_code

    # 1. Check cache first
    if cached_summary := cache.get(cache_key):
        return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

    # 2. Try to acquire lock
    try:
        # Acquire lock context manager. This will poll and wait.
        with locks.get(key=lock_key, duration=lock_duration, name=lock_name).blocking_acquire(
            initial_delay=0.25, timeout=wait_timeout
        ):
            # Re-check cache after acquiring lock, in case another process finished
            # while we were waiting for the lock.
            if cached_summary := cache.get(cache_key):
                return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

            # Lock acquired and cache is still empty, proceed with generation
            summary_dict, status_code = _generate_summary(
                group, user, force_event_id, source, cache_key, should_run_automation
            )
            _log_seer_scanner_billing_event(group, source)
            return convert_dict_key_case(summary_dict, snake_to_camel_case), status_code

    except UnableToAcquireLock:
        # Failed to acquire lock within timeout. Check cache one last time.
        if cached_summary := cache.get(cache_key):
            return convert_dict_key_case(cached_summary, snake_to_camel_case), 200
        return {"detail": "Timeout waiting for summary generation lock"}, 503
