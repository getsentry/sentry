from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import orjson
import requests
import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry import eventstore, features
from sentry.api.serializers import EventSerializer, serialize
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.autofix.utils import get_autofix_state
from sentry.constants import ObjectStatus
from sentry.eventstore.models import Event, GroupEvent
from sentry.locks import locks
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.autofix import trigger_autofix
from sentry.seer.models import SummarizeIssueResponse
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import seer_tasks
from sentry.taskworker.retry import Retry
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.autofix.trigger_autofix_from_issue_summary",
    max_retries=1,
    soft_time_limit=60,  # 1 minute
    time_limit=65,
    taskworker_config=TaskworkerConfig(
        namespace=seer_tasks,
        processing_deadline_duration=65,
        retry=Retry(
            times=1,
        ),
    ),
)
def _trigger_autofix_task(group_id: int, event_id: str, user_id: int | None, auto_run_source: str):
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

        trigger_autofix(
            group=group,
            event_id=event_id,
            user=user,
            auto_run_source=auto_run_source,
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
    connected_groups: list[Group],
    connected_serialized_events: list[dict[str, Any]],
):
    # limit amount of connected data we send to first few connected issues
    connected_groups = connected_groups[:4]
    connected_serialized_events = connected_serialized_events[:4]

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
            "connected_issues": [
                {
                    "id": connected_groups[i].id,
                    "title": connected_groups[i].title,
                    "short_id": connected_groups[i].qualified_short_id,
                    "events": [connected_serialized_events[i]],
                }
                for i in range(len(connected_groups))
            ],
            "organization_slug": group.organization.slug,
            "organization_id": group.organization.id,
            "project_id": group.project.id,
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()

    return SummarizeIssueResponse.validate(response.json())


def _generate_fixability_score(group_id: int):
    path = "/v1/automation/summarize/fixability"
    body = orjson.dumps(
        {
            "group_id": group_id,
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    response = requests.post(
        f"{settings.SEER_SEVERITY_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()

    return SummarizeIssueResponse.validate(response.json())


def _get_trace_connected_issues(event: GroupEvent) -> list[Group]:
    try:
        trace_id = event.trace_id
        if not trace_id:
            return []
    except (
        AttributeError
    ):  # sometimes the trace doesn't exist and this errors, so we just ignore it
        return []
    organization = event.group.organization
    conditions = [["trace", "=", trace_id]]
    start = event.datetime - timedelta(days=1)
    end = event.datetime + timedelta(days=1)
    project_ids = list(
        dict(
            Project.objects.filter(
                organization=organization, status=ObjectStatus.ACTIVE
            ).values_list("id", "slug")
        ).keys()
    )
    event_filter = eventstore.Filter(
        conditions=conditions, start=start, end=end, project_ids=project_ids
    )
    connected_events = eventstore.backend.get_events(
        filter=event_filter,
        referrer="api.group_ai_summary",
        tenant_ids={"organization_id": organization.id},
        limit=5,
    )
    connected_events = sorted(
        connected_events, key=lambda event: event.datetime
    )  # sort chronologically

    issue_ids = set()
    connected_issues = []
    for e in connected_events:
        if event.event_id == e.event_id:
            continue
        if e.group_id not in issue_ids:
            issue_ids.add(e.group_id)
            try:
                if e.group:
                    connected_issues.append(e.group)
            except Group.DoesNotExist:
                continue
    return connected_issues


def _generate_summary(
    group: Group,
    user: User | RpcUser | AnonymousUser,
    force_event_id: str | None,
    source: str,
    cache_key: str,
) -> tuple[dict[str, Any], int]:
    """Core logic to generate and cache the issue summary."""
    serialized_event, event = _get_event(group, user, provided_event_id=force_event_id)

    if not serialized_event or not event:
        return {"detail": "Could not find an event for the issue"}, 400

    # get trace connected issues
    connected_issues = _get_trace_connected_issues(event)

    # get recommended event for each connected issue
    serialized_events_for_connected_issues = []
    filtered_connected_issues = []
    for issue in connected_issues:
        serialized_connected_event, _ = _get_event(issue, user)
        if serialized_connected_event:
            serialized_events_for_connected_issues.append(serialized_connected_event)
            filtered_connected_issues.append(issue)

    issue_summary = _call_seer(
        group,
        serialized_event,
        filtered_connected_issues,
        serialized_events_for_connected_issues,
    )

    if features.has(
        "organizations:trigger-autofix-on-issue-summary", group.organization, actor=user
    ):
        # This is a temporary feature flag to allow us to trigger autofix on issue summary
        with sentry_sdk.start_span(op="ai_summary.generate_fixability_score"):
            try:
                issue_summary = _generate_fixability_score(group.id)
            except Exception:
                logger.exception("Error generating fixability score", extra={"group_id": group.id})

        if issue_summary.scores.is_fixable:
            with sentry_sdk.start_span(op="ai_summary.get_autofix_state"):
                autofix_state = get_autofix_state(group_id=group.id)

            if (
                not autofix_state
            ):  # Only trigger autofix if we don't have an autofix on this issue already.
                auto_run_source_map = {
                    "issue_details": "issue_summary_fixability",
                    "alert": "issue_summary_on_alert_fixability",
                }
                _trigger_autofix_task.delay(
                    group_id=group.id,
                    event_id=event.event_id,
                    user_id=user.id if user else None,
                    auto_run_source=auto_run_source_map.get(source, "unknown_source"),
                )

    summary_dict = issue_summary.dict()
    summary_dict["event_id"] = event.event_id

    cache.set(cache_key, summary_dict, timeout=int(timedelta(days=7).total_seconds()))

    return summary_dict, 200


def get_issue_summary(
    group: Group,
    user: User | RpcUser | AnonymousUser | None = None,
    force_event_id: str | None = None,
    source: str = "issue_details",
) -> tuple[dict[str, Any], int]:
    """
    Generate an AI summary for an issue.

    Args:
        group: The issue group
        user: The user requesting the summary
        force_event_id: Optional event ID to force summarizing a specific event
        source: The source triggering the summary generation

    Returns:
        A tuple containing (summary_data, status_code)
    """
    if user is None:
        user = AnonymousUser()
    if not features.has("organizations:gen-ai-features", group.organization, actor=user):
        return {"detail": "Feature flag not enabled"}, 400

    cache_key = f"ai-group-summary-v2:{group.id}"
    lock_key = f"ai-group-summary-v2-lock:{group.id}"
    lock_duration = 4  # How long the lock is held if acquired (seconds)
    wait_timeout = 5  # How long to wait for the lock (seconds)

    # if force_event_id is set, we always generate a new summary
    if force_event_id:
        summary_dict, status_code = _generate_summary(
            group, user, force_event_id, source, cache_key
        )
        return convert_dict_key_case(summary_dict, snake_to_camel_case), status_code

    # 1. Check cache first
    if cached_summary := cache.get(cache_key):
        return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

    # 2. Try to acquire lock
    try:
        # Acquire lock context manager. This will poll and wait.
        with locks.get(key=lock_key, duration=lock_duration).blocking_acquire(
            initial_delay=0.25, timeout=wait_timeout
        ):
            # Re-check cache after acquiring lock, in case another process finished
            # while we were waiting for the lock.
            if cached_summary := cache.get(cache_key):
                return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

            # Lock acquired and cache is still empty, proceed with generation
            summary_dict, status_code = _generate_summary(
                group, user, force_event_id, source, cache_key
            )
            return convert_dict_key_case(summary_dict, snake_to_camel_case), status_code

    except UnableToAcquireLock:
        # Failed to acquire lock within timeout. Check cache one last time.
        if cached_summary := cache.get(cache_key):
            return convert_dict_key_case(cached_summary, snake_to_camel_case), 200
        return {"detail": "Timeout waiting for summary generation lock"}, 503
