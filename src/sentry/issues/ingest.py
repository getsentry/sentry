from __future__ import annotations

import logging
from datetime import datetime
from hashlib import md5
from typing import Any, Mapping, Optional, Tuple, TypedDict, cast

import sentry_sdk
from django.conf import settings
from django.db import transaction

from sentry import eventstream
from sentry.constants import LOG_LEVELS_MAP
from sentry.event_manager import (
    GroupInfo,
    _get_or_create_group_environment,
    _get_or_create_group_release,
    _increment_release_associated_counts,
    _process_existing_aggregate,
    _save_grouphash_and_group,
    get_event_type,
)
from sentry.eventstore.models import Event
from sentry.issues.grouptype import should_create_group
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.models import GroupHash, Release
from sentry.ratelimits.sliding_windows import Quota, RedisSlidingWindowRateLimiter, RequestedQuota
from sentry.utils import json, metrics, redis

issue_rate_limiter = RedisSlidingWindowRateLimiter(
    **settings.SENTRY_ISSUE_PLATFORM_RATE_LIMITER_OPTIONS
)
# This should probably be configurable per team
ISSUE_QUOTA = Quota(3600, 60, 5)

logger = logging.getLogger(__name__)


def save_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event: Event
) -> Tuple[IssueOccurrence, Optional[GroupInfo]]:
    process_occurrence_data(occurrence_data)
    # Convert occurrence data to `IssueOccurrence`
    occurrence = IssueOccurrence.from_dict(occurrence_data)
    if occurrence.event_id != event.event_id:
        raise ValueError("IssueOccurrence must have the same event_id as the passed Event")
    # Note: For now we trust the project id passed along with the event. Later on we should make
    # sure that this is somehow validated.
    occurrence.save()

    try:
        release = Release.get(event.project, event.release)
    except Release.DoesNotExist:
        # The release should always exist here since event has been ingested at this point, but just
        # in case it has been deleted
        release = None
    group_info = save_issue_from_occurrence(occurrence, event, release)
    if group_info:
        send_issue_occurrence_to_eventstream(event, occurrence, group_info)
        environment = event.get_environment()
        _get_or_create_group_environment(environment, release, [group_info])
        _increment_release_associated_counts(
            group_info.group.project, environment, release, [group_info]
        )
        _get_or_create_group_release(environment, release, event, [group_info])

    return occurrence, group_info


def process_occurrence_data(occurrence_data: IssueOccurrenceData) -> None:
    # Hash fingerprints to make sure they're a consistent length
    occurrence_data["fingerprint"] = [
        md5(part.encode("utf-8")).hexdigest() for part in occurrence_data["fingerprint"]
    ]


class IssueArgs(TypedDict):
    platform: Optional[str]
    message: str
    level: Optional[int]
    culprit: str
    last_seen: datetime
    first_seen: datetime
    active_at: datetime
    type: int
    data: OccurrenceMetadata
    first_release: Optional[Release]


def _create_issue_kwargs(
    occurrence: IssueOccurrence, event: Event, release: Optional[Release]
) -> IssueArgs:
    kwargs: IssueArgs = {
        "platform": event.platform,
        # TODO: Figure out what message should be. Or maybe we just implement a platform event and
        # define it in `search_message` there.
        "message": event.search_message,
        "level": LOG_LEVELS_MAP.get(occurrence.level),
        "culprit": occurrence.culprit,
        "last_seen": event.datetime,
        "first_seen": event.datetime,
        "active_at": event.datetime,
        "type": occurrence.type.type_id,
        "first_release": release,
        "data": materialize_metadata(occurrence, event),
    }
    kwargs["data"]["last_received"] = json.datetime_to_str(event.datetime)
    return kwargs


class OccurrenceMetadata(TypedDict):
    type: str
    culprit: str
    metadata: Mapping[str, Any]
    title: str
    location: Optional[str]
    last_received: str


def materialize_metadata(occurrence: IssueOccurrence, event: Event) -> OccurrenceMetadata:
    """
    Returns the materialized metadata to be merged with issue.
    """

    event_type = get_event_type(event.data)
    event_metadata = dict(event_type.get_metadata(event.data))
    event_metadata = dict(event_metadata)
    event_metadata["title"] = occurrence.issue_title
    event_metadata["value"] = occurrence.subtitle

    return {
        "type": event_type.key,
        "title": occurrence.issue_title,
        "culprit": occurrence.culprit,
        "metadata": event_metadata,
        "location": event.location,
        "last_received": json.datetime_to_str(event.datetime),
    }


@metrics.wraps("issues.ingest.save_issue_from_occurrence")
def save_issue_from_occurrence(
    occurrence: IssueOccurrence, event: Event, release: Optional[Release]
) -> Optional[GroupInfo]:
    project = event.project
    issue_kwargs = _create_issue_kwargs(occurrence, event, release)

    # TODO: For now we will assume a single fingerprint. We can expand later if necessary.
    # Note that additional fingerprints won't be used to generated additional issues, they'll be
    # used to map the occurrence to a specific issue.
    new_grouphash = occurrence.fingerprint[0]
    existing_grouphash = (
        GroupHash.objects.filter(project=project, hash=new_grouphash)
        .select_related("group")
        .first()
    )

    if not existing_grouphash:
        cluster_key = settings.SENTRY_ISSUE_PLATFORM_RATE_LIMITER_OPTIONS.get("cluster", "default")
        client = redis.redis_clusters.get(cluster_key)
        if not should_create_group(occurrence.type, client, new_grouphash, project):
            metrics.incr("issues.issue.dropped.noise_reduction")
            return None

        with metrics.timer("issues.save_issue_from_occurrence.check_write_limits"):
            granted_quota = issue_rate_limiter.check_and_use_quotas(
                [RequestedQuota(f"issue-platform-issues:{project.id}", 1, [ISSUE_QUOTA])]
            )[0]

        if not granted_quota.granted:
            metrics.incr("issues.issue.dropped.rate_limiting")
            return None

        with sentry_sdk.start_span(
            op="issues.save_issue_from_occurrence.transaction"
        ) as span, metrics.timer(
            "issues.save_issue_from_occurrence.transaction",
            tags={"platform": event.platform or "unknown", "type": occurrence.type.type_id},
            sample_rate=1.0,
        ) as metric_tags, transaction.atomic():
            group, is_new = _save_grouphash_and_group(
                project, event, new_grouphash, **cast(Mapping[str, Any], issue_kwargs)
            )
            is_regression = False
            span.set_tag("save_issue_from_occurrence.outcome", "new_group")
            metric_tags["save_issue_from_occurrence.outcome"] = "new_group"
            metrics.incr(
                "group.created",
                skip_internal=True,
                tags={"platform": event.platform or "unknown", "type": occurrence.type.type_id},
            )
            group_info = GroupInfo(group=group, is_new=is_new, is_regression=is_regression)
    else:
        group = existing_grouphash.group
        if group.issue_category.value != occurrence.type.category:
            logger.error(
                "save_issue_from_occurrence.category_mismatch",
                extra={
                    "issue_category": group.issue_category,
                    "event_type": "platform",
                    "group_id": group.id,
                },
            )
            return None

        is_new = False
        is_regression = False

        # Note: This updates the message of the issue based on the event. Not sure what we want to
        # store there yet, so we may need to revisit that.
        is_regression = _process_existing_aggregate(group, event, issue_kwargs, release)
        group_info = GroupInfo(group=group, is_new=is_new, is_regression=is_regression)

    return group_info


def send_issue_occurrence_to_eventstream(
    event: Event, occurrence: IssueOccurrence, group_info: GroupInfo
) -> None:
    group_event = event.for_group(group_info.group)
    group_event.occurrence = occurrence

    eventstream.insert(
        event=group_event,
        is_new=group_info.is_new,
        is_regression=group_info.is_regression,
        is_new_group_environment=group_info.is_new_group_environment,
        primary_hash=occurrence.fingerprint[0],
        received_timestamp=group_event.data.get("received") or group_event.datetime,
        skip_consume=False,
        group_states=[
            {
                "id": group_info.group.id,
                "is_new": group_info.is_new,
                "is_regression": group_info.is_regression,
                "is_new_group_environment": group_info.is_new_group_environment,
            }
        ],
    )
