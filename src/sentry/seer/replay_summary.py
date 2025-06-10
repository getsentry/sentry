from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models import SummarizeReplayResponse
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


def _get_replay_data(
    replay_id: str,
    user: User | RpcUser | AnonymousUser,
    provided_replay_id: str | None = None,
) -> Any:  # todo: figure out type

    # call segments endpoint
    return None


def _call_seer(
    replay_id: str,
    replay_segment_data: Any,  # figure out type we want
):

    path = "..."
    body = orjson.dumps(
        {
            "replay_id": replay_id,
            "replay_segment_data": replay_segment_data,
            # "organization_slug": organization.slug,
            # "organization_id": organization.id,
            # "project_id": project.id,
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

    return SummarizeReplayResponse.validate(response.json())


def _generate_summary(
    replay_id: str,
    organization: Organization,
    project: Project,
    user: User | RpcUser | AnonymousUser,
    force_replay_id: str | None,
    cache_key: str,
) -> tuple[dict[str, Any], int]:  # todo: figure out type
    """Core logic to generate and cache the replay summary."""
    replay_segment_data = _get_replay_data(replay_id, user, provided_replay_id=force_replay_id)

    if not replay_segment_data:
        return {"detail": "Could not find segment data for the issue"}, 400

    replay_summary = _call_seer(
        replay_id=replay_id,
        replay_segment_data=replay_segment_data,
    )

    summary_dict = replay_summary.dict()

    cache.set(
        cache_key, summary_dict, timeout=int(timedelta(days=7).total_seconds())
    )  # why 7 days?

    return summary_dict, 200


def get_replay_summary(
    replay_id: str,
    organization: Organization,
    project: Project,
    user: User | RpcUser | AnonymousUser | None = None,
    force_replay_id: str | None = None,
) -> tuple[dict[str, Any], int]:
    """
    Generate an AI summary for a replay.

    Args:
        replay_id: The replay ID
        organization: The organization
        project: The project
        user: The user requesting the summary
        force_replay_id: Optional replay ID to force summarizing a specific replay

    Returns:
        A JSON object containing the summary data and status code
    """
    if user is None:
        user = AnonymousUser()
    if not features.has(
        "organizations:gen-ai-features", organization, actor=user
    ) or not features.has("organizations:replay-ai-summaries", organization, actor=user):
        return {"detail": "Feature flag not enabled"}, 400

    cache_key = f"replay-summary:{replay_id}"  # How to get segment length here?
    lock_key = f"replay_summary:{replay_id}"
    lock_duration = 10  # How long the lock is held if acquired (seconds)
    wait_timeout = 4.5  # How long to wait for the lock (seconds)

    # if force_replay_id is set, we always generate a new summary
    if force_replay_id:
        summary_dict, status_code = _generate_summary(
            replay_id, organization, project, user, force_replay_id, cache_key
        )
        return convert_dict_key_case(summary_dict, snake_to_camel_case), status_code

    # 1. Check cache first
    if cached_summary := cache.get(cache_key):
        return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

    # 2. Try to acquire lock
    try:
        # Acquire lock context manager. This will poll and wait.
        with locks.get(
            key=lock_key, duration=lock_duration, name="get_replay_summary"
        ).blocking_acquire(initial_delay=0.25, timeout=wait_timeout):
            # Re-check cache after acquiring lock, in case another process finished
            # while we were waiting for the lock.
            if cached_summary := cache.get(cache_key):
                return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

            # Lock acquired and cache is still empty, proceed with generation
            summary_dict, status_code = _generate_summary(
                replay_id, organization, project, user, force_replay_id, cache_key
            )
            return convert_dict_key_case(summary_dict, snake_to_camel_case), status_code

    except UnableToAcquireLock:
        # Failed to acquire lock within timeout. Check cache one last time.
        if cached_summary := cache.get(cache_key):
            return convert_dict_key_case(cached_summary, snake_to_camel_case), 200
        return {"detail": "Timeout waiting for summary generation lock"}, 503
