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
from sentry.constants import LOG_LEVELS_MAP, MAX_CULPRIT_LENGTH
from sentry.event_manager import (
    GroupInfo,
    _get_or_create_group_environment,
    _get_or_create_group_release,
    _increment_release_associated_counts,
    _process_existing_aggregate,
    get_event_type,
    save_grouphash_and_group,
)
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.grouptype import FeedbackGroup, should_create_group
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.issues.priority import PriorityChangeReason, update_priority
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.models.release import Release
from sentry.ratelimits.sliding_windows import RedisSlidingWindowRateLimiter, RequestedQuota
from sentry.services.eventstore.models import Event, GroupEvent, augment_message_with_occurrence
from sentry.types.group import PriorityLevel
from sentry.utils import json, metrics, redis
from sentry.utils.strings import truncatechars
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event
from sentry.workflow_engine.models import IncidentGroupOpenPeriod
from sentry.workflow_engine.processors.detector import (
    associate_new_group_with_detector,
    ensure_association_with_detector,
)

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
        _get_or_create_group_environment(environment, release, [group_info], event.datetime)
        _increment_release_associated_counts(
            group_info.group.project, environment, release, [group_info]
        )
        _get_or_create_group_release(environment, release, event, [group_info])

        # Create IncidentGroupOpenPeriod relationship for metric issues
        if occurrence.type == MetricIssue:
            open_period = get_latest_open_period(group_info.group)
            if open_period:
                IncidentGroupOpenPeriod.create_from_occurrence(
                    occurrence, group_info.group, open_period
                )
            else:
                logger.error(
                    "save_issue_occurrence.no_open_period",
                    extra={
                        "group_id": group_info.group.id,
                        "occurrence_id": occurrence.id,
                    },
                )

        send_issue_occurrence_to_eventstream(event, occurrence, group_info)
    return occurrence, group_info


def process_occurrence_data(data: dict[str, Any]) -> None:
    if "fingerprint" not in data:
        return

    # Hash fingerprints to make sure they're a consistent length
    data["fingerprint"] = hash_fingerprint(data["fingerprint"])


def hash_fingerprint(fingerprint: list[str]) -> list[str]:
    return [md5(part.encode("utf-8")).hexdigest() for part in fingerprint]


class IssueArgs(TypedDict):
    platform: str | None
    message: str
    level: int | None
    culprit: str | None
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
    priority = occurrence.priority or occurrence.type.default_priority

    kwargs: IssueArgs = {
        "platform": event.platform,
        # TODO: Figure out what message should be. Or maybe we just implement a platform event and
        # define it in `search_message` there.
        "message": event.search_message,
        "level": LOG_LEVELS_MAP.get(occurrence.level),
        "culprit": truncatechars(occurrence.culprit, MAX_CULPRIT_LENGTH),
        "last_seen": event.datetime,
        "first_seen": event.datetime,
        "active_at": event.datetime,
        "type": occurrence.type.type_id,
        "first_release": release,
        "data": materialize_metadata(occurrence, event),
        "priority": priority,
    }
    kwargs["data"]["last_received"] = json.datetime_to_str(event.datetime)
    return kwargs


class OccurrenceMetadata(TypedDict):
    type: str
    culprit: str | None
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
    event_metadata: dict[str, Any] = dict(event_type.get_metadata(event.data))
    event_metadata = dict(event_metadata)
    # Don't clobber existing metadata
    event_metadata.update(event.get_event_metadata())
    event_metadata["title"] = occurrence.issue_title
    event_metadata["value"] = occurrence.subtitle
    event_metadata["initial_priority"] = occurrence.priority

    if occurrence.type == FeedbackGroup:
        # TODO: Should feedbacks be their own event type, so above call to event.get_event_medata
        # could populate this instead?
        # Or potentially, could add a method to GroupType called get_metadata
        event_metadata["contact_email"] = occurrence.evidence_data.get("contact_email")
        event_metadata["message"] = occurrence.evidence_data.get("message")
        event_metadata["name"] = occurrence.evidence_data.get("name")
        event_metadata["source"] = occurrence.evidence_data.get("source")
        event_metadata["summary"] = occurrence.evidence_data.get("summary")
        associated_event_id = occurrence.evidence_data.get("associated_event_id")
        if associated_event_id:
            event_metadata["associated_event_id"] = associated_event_id

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

    existing_grouphashes = {
        gh.hash: gh
        for gh in GroupHash.objects.filter(
            project=project, hash__in=occurrence.fingerprint
        ).select_related("group")
    }
    primary_grouphash = None
    for fingerprint_hash in occurrence.fingerprint:
        if fingerprint_hash in existing_grouphashes:
            primary_grouphash = existing_grouphashes[fingerprint_hash]
            break

    if not primary_grouphash:
        primary_hash = occurrence.fingerprint[0]

        cluster_key = settings.SENTRY_ISSUE_PLATFORM_RATE_LIMITER_OPTIONS.get("cluster", "default")
        client = redis.redis_clusters.get(cluster_key)
        if not should_create_group(occurrence.type, client, primary_hash, project):
            metrics.incr(
                "issues.issue.dropped.noise_reduction",
                tags={"group_type": occurrence.type.slug},
            )
            return None

        with metrics.timer("issues.save_issue_from_occurrence.check_write_limits"):
            granted_quota = issue_rate_limiter.check_and_use_quotas(
                [
                    RequestedQuota(
                        f"issue-platform-issues:{project.id}:{occurrence.type.slug}",  # noqa E231 missing whitespace after ':'
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
            group, is_new, primary_grouphash = save_grouphash_and_group(
                project, event, primary_hash, **issue_kwargs
            )
            if is_new:
                detector_id = None
                if occurrence.evidence_data:
                    detector_id = occurrence.evidence_data.get("detector_id")
                associate_new_group_with_detector(group, detector_id)

            open_period = get_latest_open_period(group)
            if open_period is not None:
                highest_seen_priority = group.priority
                open_period.update(
                    data={**open_period.data, "highest_seen_priority": highest_seen_priority}
                )
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

    elif primary_grouphash.group is None:
        return None
    else:
        group = primary_grouphash.group
        if group.issue_type.type_id != occurrence.type.type_id:
            logger.error(
                "save_issue_from_occurrence.type_mismatch",
                extra={
                    "issue_type": group.issue_type.slug,
                    "occurrence_type": occurrence.type.slug,
                    "event_type": "platform",
                    "group_id": group.id,
                },
            )
            return None

        group_event = GroupEvent.from_event(event, group)
        group_event.occurrence = occurrence
        is_regression = _process_existing_aggregate(group, group_event, issue_kwargs, release)
        group_info = GroupInfo(group=group, is_new=False, is_regression=is_regression)

        detector_id = None
        if occurrence.evidence_data:
            detector_id = occurrence.evidence_data.get("detector_id")
        ensure_association_with_detector(group, detector_id)

        # if it's a regression and the priority changed, we should update the existing GroupOpenPeriodActivity
        # row if applicable. Otherwise, we should record a new row if applicable.
        if (
            issue_kwargs["priority"]
            and group.priority != issue_kwargs["priority"]
            and group.priority_locked_at is None
        ):
            update_priority(
                group=group,
                priority=PriorityLevel(issue_kwargs["priority"]),
                sender="save_issue_from_occurrence",
                reason=PriorityChangeReason.ISSUE_PLATFORM,
                project=project,
                is_regression=is_regression,
            )

            open_period = get_latest_open_period(group)
            if open_period is not None:
                highest_seen_priority = open_period.data.get("highest_seen_priority", None)
                if highest_seen_priority is None:
                    highest_seen_priority = group.priority
                elif group.priority is not None:
                    # XXX: we know this is not None, because we just set the group's priority
                    highest_seen_priority = max(highest_seen_priority, group.priority)
                open_period.update(
                    data={**open_period.data, "highest_seen_priority": highest_seen_priority}
                )

    additional_hashes = [f for f in occurrence.fingerprint if f != primary_grouphash.hash]
    for fingerprint_hash in additional_hashes:
        # Attempt to create the additional grouphash links. They shouldn't be linked to other groups, but guard against
        # that
        group_hash, created = GroupHash.objects.get_or_create(
            project=project, hash=fingerprint_hash, defaults={"group": group_info.group}
        )
        if not created:
            logger.warning(
                "Failed to create additional grouphash for group, grouphash associated with existing group",
                extra={
                    "new_group_id": group_info.group.id,
                    "hash": fingerprint_hash,
                    "existing_group_id": group_hash.group_id,
                },
            )

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
