from __future__ import annotations

from typing import TypedDict, Optional, Sequence, Mapping, Any

from django.db import transaction
from sentry import metrics
from sentry.event_manager import EventManager
from sentry.eventstore.models import Event
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models import GroupHash


class IssueEvidenceData(TypedDict):
    name: str
    value: str
    important: bool


class IssueOccurrenceData(TypedDict):
    id: str
    fingerprint: Sequence[str]
    issue_title: str
    subtitle: str
    resource_id: str | None
    evidence_data: Mapping[str, Any]
    evidence_display: Sequence[IssueEvidenceData]
    type: int  # Not sure if the consumer should convert to the appropriate type here as part of validation
    detection_time: float  # Not sure if the consumer should convert to the appropriate type here as part of validation
    event_id: Optional[str]
    event: Optional[Event]


def save_issue_occurrence(occurrence_data: IssueOccurrenceData):
    event_id = occurrence_data.get("event_id")
    if not event_id:
        event = occurrence_data.pop("event", None)
        occurrence_data["event_id"] = event["id"]

    # Convert occurrence data to `IssueOccurrence`
    occurrence = IssueOccurrence(occurrence_data)
    occurrence.save()

    if event:
        # TODO: Save event via EventManager
        pass

    _save_aggregate_issue_platform(occurrence)

    # Need to write to eventstream here, ideally with the occurrence passed as well
    # _eventstream_insert_many(jobs)



@metrics.wraps("save_event.save_aggregate_performance")
def _save_aggregate_issue_platform(occurrence: IssueOccurrence) -> None:

    MAX_GROUPS = (
        10  # safety check in case we are passed too many. constant will live somewhere else tbd
    )
    groups = []
    hashes = []
    # Where to get project
    # project = event.project

    kwargs = {}
    # Can we just use the occurrence here?
    # kwargs = _create_kwargs(job)
    # What metadata do we need to materialize? Do we need the event?
    # kwargs["data"] = materialize_metadata(
    #     event.data,
    #     get_event_type(event.data),
    #     dict(job["event_metadata"]),
    # )
    # Detection time or should this be received time of the event?
    #kwargs["data"]["last_received"] = job["received_timestamp"]

    # We can probably just assume a single fingerprint for now and expand later if necessary
    group_hash = occurrence.fingerprint[0]

    existing_grouphash = GroupHash.objects.filter(
        project=project, hash=group_hash
    ).select_related("group")
    if not existing_grouphash:

        new_grouphashes_count = 1
        # Probably don't need a ratelimiter initially
        # with metrics.timer("performance.performance_issue.check_write_limits"):
        #     granted_quota = issue_rate_limiter.check_and_use_quotas(
        #         [
        #             RequestedQuota(
        #                 f"performance-issues:{project.id}",
        #                 new_grouphashes_count,
        #                 [PERFORMANCE_ISSUE_QUOTA],
        #             )
        #         ]
        #     )[0]

        # Log how many groups didn't get created because of rate limiting
        # _dropped_group_hash_count = new_grouphashes_count - granted_quota.granted
        # metrics.incr("performance.performance_issue.dropped", _dropped_group_hash_count)

        with sentry_sdk.start_span(
            op="event_manager.create_performance_group_transaction"
        ) as span, metrics.timer(
            "event_manager.create_performance_group_transaction",
            tags={"platform": event.platform or "unknown"},
            sample_rate=1.0,
        ) as metric_tags, transaction.atomic():
            span.set_tag("create_group_transaction.outcome", "no_group")
            metric_tags["create_group_transaction.outcome"] = "no_group"

            group_kwargs = kwargs.copy()
            group_kwargs["type"] = occurrence.type.value

            # What metadata do we need?
            # group_kwargs["data"]["metadata"] = inject_performance_problem_metadata(
            #     group_kwargs["data"]["metadata"], problem
            # )
            #
            # if group_kwargs["data"]["metadata"]:
            #     group_kwargs["message"] = _message_from_metadata(
            #         group_kwargs["data"]["metadata"]
            #     )

            # We don't really need the event here I think, it just contains platform?
            # group, is_new = _save_grouphash_and_group(
            #     project, event, new_grouphash, **group_kwargs
            # )

            is_regression = False

            # span.set_tag("create_group_transaction.outcome", "new_group")
            # metric_tags["create_group_transaction.outcome"] = "new_group"
            #
            # metrics.incr(
            #     "group.created",
            #     skip_internal=True,
            #     tags={"platform": job["platform"] or "unknown"},
            # )
            #
            # job["groups"].append(
            #     GroupInfo(group=group, is_new=is_new, is_regression=is_regression)
            # )
            hashes.append(new_grouphash)

    # if existing_grouphashes:
    #
    #     # GROUP EXISTS
    #     for existing_grouphash in existing_grouphashes:
    #         group = existing_grouphash.group
    #         if group.issue_category != GroupCategory.PERFORMANCE:
    #             logger.info(
    #                 "event_manager.category_mismatch",
    #                 extra={
    #                     "issue_category": group.issue_category,
    #                     "event_type": "performance",
    #                 },
    #             )
    #             continue
    #
    #         is_new = False
    #
    #         problem = performance_problems_by_hash[existing_grouphash.hash]
    #         group_kwargs = kwargs.copy()
    #         group_kwargs["data"]["metadata"] = inject_performance_problem_metadata(
    #             group_kwargs["data"]["metadata"], problem
    #         )
    #         if group_kwargs["data"]["metadata"].get("title"):
    #             group_kwargs["message"] = _message_from_metadata(
    #                 group_kwargs["data"]["metadata"]
    #             )
    #
    #         is_regression = _process_existing_aggregate(
    #             group=group, event=job["event"], data=group_kwargs, release=job["release"]
    #         )
    #
    #         job["groups"].append(
    #             GroupInfo(group=group, is_new=is_new, is_regression=is_regression)
    #         )
    #         hashes.append(existing_grouphash.hash)
    #
    # job["event"].groups = [group_info.group for group_info in job["groups"]]
    # job["event"].data["hashes"] = hashes
