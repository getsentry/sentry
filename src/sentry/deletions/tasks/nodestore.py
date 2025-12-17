from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk
from snuba_sdk import DeleteQuery, Request

from sentry import eventstream, nodestore, options
from sentry.deletions.tasks.scheduled import MAX_RETRIES, logger
from sentry.eventstream.eap import delete_groups_from_eap_rpc
from sentry.exceptions import DeleteAborted
from sentry.models.eventattachment import EventAttachment
from sentry.models.userreport import UserReport
from sentry.services import eventstore
from sentry.services.eventstore.models import Event
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.taskworker.namespaces import deletion_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.snuba import UnqualifiedQueryError, bulk_snuba_queries
from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded

EVENT_CHUNK_SIZE = 10000
# https://github.com/getsentry/snuba/blob/54feb15b7575142d4b3af7f50d2c2c865329f2db/snuba/datasets/configuration/issues/storages/search_issues.yaml#L139
ISSUE_PLATFORM_MAX_ROWS_TO_DELETE = 2000000


class RetryTask(Exception):
    pass


@instrumented_task(
    name="sentry.deletions.tasks.nodestore.delete_events_from_nodestore_and_eventstore",
    namespace=deletion_tasks,
    processing_deadline_duration=60 * 20,
    retry=Retry(
        on=(RetryTask,),
        times=MAX_RETRIES,
        delay=60 * 5,
    ),
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(DeleteAborted,))
@track_group_async_operation
def delete_events_for_groups_from_nodestore_and_eventstore(
    organization_id: int,
    project_id: int,
    group_ids: Sequence[int],
    times_seen: Sequence[int],
    transaction_id: str,
    dataset_str: str,
    referrer: str,
    last_event_id: str | None = None,
    last_event_timestamp: str | None = None,
    **kwargs: Any,
) -> None:
    """
    Delete error events from nodestore by fetching and processing events in chunks.

    This task fetches events for the given groups and deletes them from nodestore.
    It processes events in chunks and can be called recursively to handle large numbers of events.

    Args:
        organization_id:        Organization ID for tenant context
        project_id:             Project ID that all groups belong to
        group_ids:              List of group IDs to delete events for (sorted by times_seen & id)
        times_seen:             List of times_seen for the groups (the caller has to ensure it matches to the group_ids)
        transaction_id:         Unique identifier to help debug deletion tasks
        dataset_str:            Dataset string to delete events from
        referrer:               Referrer for the task
        last_event_id:          Event ID of the last processed event (for pagination)
        last_event_timestamp:   Timestamp of the last processed event (for pagination)
    """
    prefix = "deletions.nodestore"
    if not group_ids:
        raise DeleteAborted("delete_events_from_nodestore.empty_group_ids")

    kwargs_to_schedule_next_task = {
        "organization_id": organization_id,
        "project_id": project_id,
        "group_ids": group_ids,
        "times_seen": times_seen,
        "transaction_id": transaction_id,
        "dataset_str": dataset_str,
        "referrer": referrer,
    }

    # These can be used for debugging
    extra = {"project_id": project_id, "transaction_id": transaction_id}
    sentry_sdk.set_tags(extra)
    logger.info(f"{prefix}.started", extra=extra)

    try:
        # Fetch events for deletion
        events = fetch_events_from_eventstore(
            project_id=project_id,
            group_ids=group_ids,
            dataset=Dataset(dataset_str),
            referrer=referrer,
            tenant_ids={"referrer": referrer, "organization_id": organization_id},
            limit=EVENT_CHUNK_SIZE,
            last_event_id=last_event_id,
            last_event_timestamp=last_event_timestamp,
        )
        if len(events) > 0:
            last_event = events[-1]
            delete_events_from_nodestore(events=events, dataset=Dataset(dataset_str))
            delete_dangling_attachments_and_user_reports(events, [project_id])
            delete_events_for_groups_from_nodestore_and_eventstore.apply_async(
                kwargs={
                    **kwargs_to_schedule_next_task,
                    "last_event_id": last_event.event_id,
                    "last_event_timestamp": last_event.timestamp,
                },
            )
        else:
            logger.info(f"{prefix}.completed", extra=extra)
            # The fetch request for the nodestore uses the eventstore to determine what IDs to delete
            # from the nodestore. This is why we only delete from the eventstore once we've deleted
            # from the nodestore.
            delete_events_from_eventstore(
                organization_id, project_id, group_ids, times_seen, Dataset(dataset_str)
            )
    except UnqualifiedQueryError as error:
        if error.args[0] == "All project_ids from the filter no longer exist":
            # We currently don't have a way to handle this error, so we just track it and don't retry the task
            metrics.incr(f"{prefix}.warning", tags={"type": "all-projects-deleted"}, sample_rate=1)
        else:
            metrics.incr(f"{prefix}.error", tags={"type": "unqualified-query-error"}, sample_rate=1)
            # Report to Sentry to investigate
            raise DeleteAborted(f"{error.args[0]}. We won't retry this task.") from error

    # TODO: Add specific error handling for retryable errors and raise RetryTask when appropriate
    except Exception:
        metrics.incr(f"{prefix}.error", tags={"type": "unhandled-exception"}, sample_rate=1)
        raise DeleteAborted("Failed to delete events from nodestore. We won't retry this task.")


def fetch_events_from_eventstore(
    *,
    project_id: int,
    group_ids: Sequence[int],
    dataset: Dataset,
    referrer: str,
    tenant_ids: Mapping[str, Any],
    limit: int = EVENT_CHUNK_SIZE,
    last_event_id: str | None = None,
    last_event_timestamp: str | None = None,
    **kwargs: Any,
) -> list[Event]:
    logger.info("Fetching %s events for deletion.", limit)
    conditions = []
    if last_event_id and last_event_timestamp:
        conditions.extend(
            [
                ["timestamp", "<=", last_event_timestamp],
                [["timestamp", "<", last_event_timestamp], ["event_id", "<", last_event_id]],
            ]
        )

    events = eventstore.backend.get_unfetched_events(
        filter=eventstore.Filter(
            conditions=conditions,
            project_ids=[project_id],
            group_ids=group_ids,
        ),
        limit=limit,
        referrer=referrer,
        orderby=["-timestamp", "-event_id"],
        tenant_ids=tenant_ids,
        dataset=dataset,
    )
    return events


def delete_events_from_nodestore(events: Sequence[Event], dataset: Dataset) -> None:
    node_ids = [
        Event.generate_node_id(
            event.project_id,
            (
                event._snuba_data["occurrence_id"]
                if dataset == Dataset.IssuePlatform
                else event.event_id
            ),
        )
        for event in events
    ]
    nodestore.backend.delete_multi(node_ids)


def delete_events_from_eventstore(
    organization_id: int,
    project_id: int,
    group_ids: Sequence[int],
    times_seen: Sequence[int],
    dataset: Dataset,
) -> None:
    if dataset == Dataset.IssuePlatform:
        delete_events_from_eventstore_issue_platform(
            organization_id, project_id, group_ids, times_seen
        )
    else:
        eventstream_state = eventstream.backend.start_delete_groups(project_id, group_ids)
        eventstream.backend.end_delete_groups(eventstream_state)

    delete_events_from_eap(organization_id, project_id, group_ids, dataset)


def delete_events_from_eap(
    organization_id: int,
    project_id: int,
    group_ids: Sequence[int],
    dataset: Dataset,
) -> None:
    if not options.get("eventstream.eap.deletion-enabled"):
        return

    retry_policy = ConditionalRetryPolicy(
        test_function=lambda attempt, exc: attempt < 5
        and isinstance(exc, SnubaRPCRateLimitExceeded),
        delay_function=exponential_delay(1.0),
    )

    try:
        retry_policy(
            lambda: delete_groups_from_eap_rpc(
                organization_id=organization_id,
                project_id=project_id,
                group_ids=group_ids,
                referrer="deletions.group.eap",
            )
        )
        metrics.incr(
            "deletions.group.eap.success",
            tags={"dataset": dataset.value},
            sample_rate=1.0,
        )
    except Exception:
        logger.exception(
            "Failed to delete groups from EAP",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "group_ids": group_ids[:10],
                "dataset": dataset.value,
            },
        )
        metrics.incr(
            "deletions.group.eap.failure",
            tags={"dataset": dataset.value},
            sample_rate=1.0,
        )


def delete_events_from_eventstore_issue_platform(
    organization_id: int, project_id: int, group_ids: Sequence[int], times_seen_list: Sequence[int]
) -> None:
    """
    When this task executes, the groups will have been deleted from the DB, thus, we won't have access
    to the times_seen field via the Group model.
    """
    requests = []
    # Split group_ids into batches where the sum of times_seen is less than ISSUE_PLATFORM_MAX_ROWS_TO_DELETE
    current_batch: list[int] = []
    current_batch_rows = 0

    for group_id, times_seen in zip(group_ids, times_seen_list):
        # If adding this group would exceed the limit, create a request with the current batch
        if current_batch_rows + times_seen > ISSUE_PLATFORM_MAX_ROWS_TO_DELETE:
            requests.append(delete_request(organization_id, project_id, current_batch))
            # We now start a new batch
            current_batch = [group_id]
            current_batch_rows = times_seen
        else:
            current_batch.append(group_id)
            current_batch_rows += times_seen

    # Add the final batch if it's not empty
    if current_batch:
        requests.append(delete_request(organization_id, project_id, current_batch))
    bulk_snuba_queries(requests)


def delete_request(organization_id: int, project_id: int, group_ids: Sequence[int]) -> Request:
    query = DeleteQuery(
        Dataset.IssuePlatform.value,
        column_conditions={"project_id": [project_id], "group_id": list(group_ids)},
    )
    return Request(
        dataset=Dataset.IssuePlatform.value,
        app_id=Referrer.DELETIONS_GROUP.value,
        query=query,
        tenant_ids=tenant_ids(organization_id),
    )


def delete_dangling_attachments_and_user_reports(
    events: Sequence[Event], project_ids: Sequence[int]
) -> None:
    """
    Remove EventAttachment and UserReport *again* as those may not have a
    group ID, therefore there may be dangling ones after "regular" model
    deletion.
    """
    # We don't want to fail the deletion task if we can't delete the attachments and user reports
    event_ids = [event.event_id for event in events]
    try:
        EventAttachment.objects.filter(event_id__in=event_ids, project_id__in=project_ids).delete()
        UserReport.objects.filter(event_id__in=event_ids, project_id__in=project_ids).delete()
    except Exception:
        pass


def tenant_ids(organization_id: int) -> Mapping[str, Any]:
    return {"referrer": Referrer.DELETIONS_GROUP.value, "organization_id": organization_id}
