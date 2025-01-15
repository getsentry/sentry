from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime
from hashlib import md5
from typing import Any, TypedDict

import sentry_sdk
from django.conf import settings
from django.db import router, transaction

from sentry import eventstream
from sentry.constants import LOG_LEVELS_MAP
from sentry.event_manager import (
    GroupInfo,
    _get_or_create_group_environment,
    _get_or_create_group_release,
    _increment_release_associated_counts,
    _process_existing_aggregate,
    get_event_type,
    save_grouphash_and_group,
)
from sentry.eventstore.models import Event, GroupEvent, augment_message_with_occurrence
from sentry.issues.grouptype import FeedbackGroup, should_create_group
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.models.release import Release
from sentry.ratelimits.sliding_windows import RedisSlidingWindowRateLimiter, RequestedQuota
from sentry.utils import json, metrics, redis
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

issue_rate_limiter = RedisSlidingWindowRateLimiter(
    **settings.SENTRY_ISSUE_PLATFORM_RATE_LIMITER_OPTIONS
)


logger = logging.getLogger(__name__)


@sentry_sdk.tracing.trace
def save_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event: Event
) -> tuple[IssueOccurrence, GroupInfo | None]:
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
        environment = event.get_environment()
        _get_or_create_group_environment(environment, release, [group_info])
        _increment_release_associated_counts(
            group_info.group.project, environment, release, [group_info]
        )
        _get_or_create_group_release(environment, release, event, [group_info])
        send_issue_occurrence_to_eventstream(event, occurrence, group_info)
    return occurrence, group_info


def hash_fingerprint_parts(fingerprint: list[str]) -> list[str]:
    return [md5(part.encode("utf-8")).hexdigest() for part in fingerprint]


class IssueArgs(TypedDict):
    platform: str | None
    message: str
    level: int | None
    culprit: str
    last_seen: datetime
    first_seen: datetime
    active_at: datetime
    type: int
    data: OccurrenceMetadata
    first_release: Release | None
    priority: int | None


@sentry_sdk.tracing.trace
def _create_issue_kwargs(
    occurrence: IssueOccurrence, event: Event, release: Release | None
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
        "priority": (
            occurrence.initial_issue_priority
            if occurrence.initial_issue_priority is not None
            else occurrence.type.default_priority
        ),
    }
    kwargs["data"]["last_received"] = json.datetime_to_str(event.datetime)
    return kwargs


class OccurrenceMetadata(TypedDict):
    type: str
    culprit: str
    metadata: Mapping[str, Any]
    title: str
    location: str | None
    last_received: str


@sentry_sdk.tracing.trace
def materialize_metadata(occurrence: IssueOccurrence, event: Event) -> OccurrenceMetadata:
    """
    Returns the materialized metadata to be merged with issue.
    """

    event_type = get_event_type(event.data)
    event_metadata = dict(event_type.get_metadata(event.data))
    event_metadata = dict(event_metadata)
    # Don't clobber existing metadata
    event_metadata.update(event.get_event_metadata())
    event_metadata["title"] = occurrence.issue_title
    event_metadata["value"] = occurrence.subtitle
    event_metadata["initial_priority"] = occurrence.initial_issue_priority

    if occurrence.type == FeedbackGroup:
        # TODO: Should feedbacks be their own event type, so above call to event.get_event_medata
        # could populate this instead?
        # Or potentially, could add a method to GroupType called get_metadata
        event_metadata["contact_email"] = occurrence.evidence_data.get("contact_email")
        event_metadata["message"] = occurrence.evidence_data.get("message")
        event_metadata["name"] = occurrence.evidence_data.get("name")
        event_metadata["source"] = occurrence.evidence_data.get("source")

    return {
        "type": event_type.key,
        "title": occurrence.issue_title,
        "culprit": occurrence.culprit,
        "metadata": event_metadata,
        "location": event.location,
        "last_received": json.datetime_to_str(event.datetime),
    }


@sentry_sdk.tracing.trace
@metrics.wraps("issues.ingest.save_issue_from_occurrence")
def save_issue_from_occurrence(
    occurrence: IssueOccurrence, event: Event, release: Release | None
) -> GroupInfo | None:
    project = event.project
    issue_kwargs = _create_issue_kwargs(occurrence, event, release)
    # We need to augment the message with occurrence data here since we can't build a `GroupEvent`
    # until after we have created a `Group`.
    issue_kwargs["message"] = augment_message_with_occurrence(issue_kwargs["message"], occurrence)

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
                [
                    RequestedQuota(
                        f"issue-platform-issues:{project.id}:{occurrence.type.slug}",
                        1,
                        [occurrence.type.creation_quota],
                    )
                ]
            )[0]

        if not granted_quota.granted:
            metrics.incr("issues.issue.dropped.rate_limiting")
            return None

        with (
            sentry_sdk.start_span(op="issues.save_issue_from_occurrence.transaction") as span,
            metrics.timer(
                "issues.save_issue_from_occurrence.transaction",
                tags={"platform": event.platform or "unknown", "type": occurrence.type.type_id},
                sample_rate=1.0,
            ) as metric_tags,
            transaction.atomic(router.db_for_write(GroupHash)),
        ):
            group, is_new = save_grouphash_and_group(project, event, new_grouphash, **issue_kwargs)
            is_regression = False
            span.set_tag("save_issue_from_occurrence.outcome", "new_group")
            metric_tags["save_issue_from_occurrence.outcome"] = "new_group"
            metrics.incr(
                "group.created",
                skip_internal=True,
                tags={
                    "platform": event.platform or "unknown",
                    "type": occurrence.type.type_id,
                    "sdk": normalized_sdk_tag_from_event(event.data),
                },
            )
            group_info = GroupInfo(group=group, is_new=is_new, is_regression=is_regression)

            # This only applies to events with stacktraces
            frame_mix = event.get_event_metadata().get("in_app_frame_mix")
            if is_new and frame_mix:
                metrics.incr(
                    "grouping.in_app_frame_mix",
                    sample_rate=1.0,
                    tags={
                        "platform": event.platform or "unknown",
                        "frame_mix": frame_mix,
                        "sdk": normalized_sdk_tag_from_event(event.data),
                    },
                )
        if is_new and occurrence.assignee:
            try:
                # Since this calls hybrid cloud it has to be run outside the transaction
                assignee = occurrence.assignee.resolve()
                GroupAssignee.objects.assign(group, assignee, create_only=True)
            except Exception:
                logger.exception("Failed process assignment for occurrence")

    elif existing_grouphash.group is None:
        return None
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

        group_event = GroupEvent.from_event(event, group)
        group_event.occurrence = occurrence
        is_regression = _process_existing_aggregate(group, group_event, issue_kwargs, release)
        group_info = GroupInfo(group=group, is_new=False, is_regression=is_regression)

    return group_info


@sentry_sdk.tracing.trace
def send_issue_occurrence_to_eventstream(
    event: Event, occurrence: IssueOccurrence, group_info: GroupInfo
) -> None:
    group_event = event.for_group(group_info.group)
    group_event.occurrence = occurrence

    eventstream.backend.insert(
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
