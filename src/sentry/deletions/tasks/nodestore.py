from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk

from sentry import eventstore, nodestore
from sentry.deletions.defaults.group import EVENT_CHUNK_SIZE
from sentry.deletions.tasks.scheduled import MAX_RETRIES, logger
from sentry.eventstore.models import Event
from sentry.exceptions import DeleteAborted
from sentry.models.eventattachment import EventAttachment
from sentry.models.project import Project
from sentry.models.userreport import UserReport
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import deletion_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics


@instrumented_task(
    name="sentry.deletions.tasks.nodestore.delete_events_from_nodestore",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    acks_late=True,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=deletion_tasks,
        processing_deadline_duration=60 * 20,
        retry=Retry(
            times=MAX_RETRIES,
            delay=60 * 5,
        ),
    ),
)
@retry(exclude=(DeleteAborted,))
@track_group_async_operation
def delete_events_for_groups_from_nodestore(
    organization_id: int,
    project_id: int,
    group_ids: Sequence[int],
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
        group_ids:              List of group IDs to delete events for
        transaction_id:         Unique identifier to help debug deletion tasks
        dataset:                Dataset to delete events from
        referrer:               Referrer for the task
        last_event_id:          Event ID of the last processed event (for pagination)
        last_event_timestamp:   Timestamp of the last processed event (for pagination)
    """
    if not group_ids:
        raise DeleteAborted("delete_events_from_nodestore.empty_group_ids")

    args_to_schedule_next_task = [
        organization_id,
        project_id,
        group_ids,
        transaction_id,
        dataset_str,
        referrer,
    ]
    dataset = Dataset(dataset_str)

    # These can be used for debugging
    extra = {"project_id": project_id, "transaction_id": transaction_id}
    sentry_sdk.set_tags(extra)
    logger.info("deletions.nodestore.started", extra=extra)
    project = Project.objects.get(id=project_id)
    assert project.organization_id == organization_id
    task = NodestoreDeletionTask(
        organization_id=organization_id,
        project_id=project_id,
        group_ids=group_ids,
        dataset=dataset,
        referrer=referrer,
    )

    try:
        # Fetch events for deletion
        events = task.fetch_events(last_event_id, last_event_timestamp)
        if len(events) > 0:
            last_event = events[-1]
            _delete_events_from_nodestore(events=events, extra=extra)
            _delete_dangling_attachments_and_user_reports(events, [project_id])
            delete_events_for_groups_from_nodestore.apply_async(
                args=args_to_schedule_next_task,
                kwargs={
                    "last_event_id": last_event.event_id,
                    "last_event_timestamp": last_event.timestamp,
                },
            )
        else:
            logger.info("deletions.nodestore.completed", extra=extra)

    except Exception:
        metrics.incr("deletions.nodestore.delete_events_from_nodestore.error", 1, sample_rate=1)
        logger.warning("deletions.nodestore.failed", extra=extra)
        raise


class NodestoreDeletionTask:
    def __init__(
        self,
        organization_id: int,
        project_id: int,
        group_ids: Sequence[int],
        dataset: Dataset,
        referrer: str,
    ):
        """
        Initialize the NodestoreDeletionTask.

        Args:
            organization_id: Organization ID for tenant context
            project_id: Project ID that all groups belong to
            group_ids: List of group IDs to delete events for
            dataset: Dataset to delete events from
            referrer: Referrer for the task
        """
        self.organization_id = organization_id
        self.project_id = project_id
        self.group_ids = group_ids
        self.dataset = dataset
        self.referrer = referrer

    @property
    def tenant_ids(self) -> Mapping[str, Any]:
        return {"referrer": self.referrer, "organization_id": self.organization_id}

    def fetch_events(
        self,
        last_event_id: str | None = None,
        last_event_timestamp: str | None = None,
    ) -> list[Event]:
        """Fetch error events for the given groups."""
        return _fetch_events(
            group_ids=self.group_ids,
            project_id=self.project_id,
            referrer=self.referrer,
            dataset=self.dataset,
            tenant_ids=self.tenant_ids,
            last_event_id=last_event_id,
            last_event_timestamp=last_event_timestamp,
        )


def _fetch_events(
    group_ids: Sequence[int],
    project_id: int,
    referrer: str,
    dataset: Dataset,
    tenant_ids: Mapping[str, Any],
    last_event_id: str | None = None,
    last_event_timestamp: str | None = None,
) -> list[Event]:
    logger.info("Fetching %s events for deletion.", EVENT_CHUNK_SIZE)
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
        limit=EVENT_CHUNK_SIZE,
        referrer=referrer,
        orderby=["-timestamp", "-event_id"],
        tenant_ids=tenant_ids,
        dataset=dataset,
    )
    return events


def _delete_events_from_nodestore(events: Sequence[Event], extra: dict[str, Any]) -> None:
    node_ids = [Event.generate_node_id(event.project_id, event.event_id) for event in events]
    nodestore.backend.delete_multi(node_ids)
    logger.info("deletions.nodestore.chunk_completed", extra=extra)
    metrics.incr(
        "deletions.nodestore.delete_events_from_nodestore.chunk_success",
        len(node_ids),
        sample_rate=1,
    )


def _delete_dangling_attachments_and_user_reports(
    events: Sequence[Event], project_ids: Sequence[int]
) -> None:
    """
    Remove EventAttachment and UserReport *again* as those may not have a
    group ID, therefore there may be dangling ones after "regular" model
    deletion.
    """
    event_ids = [event.event_id for event in events]
    EventAttachment.objects.filter(event_id__in=event_ids, project_id__in=project_ids).delete()
    UserReport.objects.filter(event_id__in=event_ids, project_id__in=project_ids).delete()
