from __future__ import annotations

import os
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from sentry_sdk import set_tag
from snuba_sdk import DeleteQuery, Request

from sentry import eventstore, eventstream, models, nodestore
from sentry.eventstore.models import Event
from sentry.issues.grouptype import GroupCategory, InvalidGroupTypeError
from sentry.models.group import Group, GroupStatus
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.snuba.dataset import Dataset
from sentry.tasks.delete_seer_grouping_records import may_schedule_task_to_delete_hashes_from_seer
from sentry.utils.snuba import bulk_snuba_queries

from ..base import BaseDeletionTask, BaseRelation, ModelDeletionTask, ModelRelation
from ..manager import DeletionTaskManager

# Group models that relate only to groups and not to events. We assume those to
# be safe to delete/mutate within a single transaction for user-triggered
# actions (delete/reprocess/merge/unmerge)
DIRECT_GROUP_RELATED_MODELS = (
    # prioritize GroupHash
    models.GroupHash,
    models.GroupAssignee,
    models.GroupCommitResolution,
    models.GroupLink,
    models.GroupHistory,
    models.GroupBookmark,
    models.GroupMeta,
    models.GroupEnvironment,
    models.GroupOpenPeriod,
    models.GroupRelease,
    models.GroupRedirect,
    models.GroupResolution,
    models.GroupRuleStatus,
    models.GroupSeen,
    models.GroupShare,
    models.GroupSnooze,
    models.GroupInbox,
    models.GroupOwner,
    models.GroupEmailThread,
    models.GroupSubscription,
    models.GroupHistory,
    RuleFireHistory,
)

_GROUP_RELATED_MODELS = DIRECT_GROUP_RELATED_MODELS + (
    models.UserReport,
    models.EventAttachment,
    NotificationMessage,
)


class EventsBaseDeletionTask(BaseDeletionTask[Group]):
    """
    Base class to delete events associated to groups and its related models.
    """

    # Number of events fetched from eventstore per chunk() call.
    DEFAULT_CHUNK_SIZE = 10000
    referrer = "deletions.group"
    dataset: Dataset

    def __init__(
        self, manager: DeletionTaskManager, groups: Sequence[Group], **kwargs: Any
    ) -> None:
        self.groups = groups
        # Use self.last_event to keep track of the last event processed in the chunk method.
        self.last_event: Event | None = None
        self.set_group_and_project_ids()
        super().__init__(manager, **kwargs)

    def set_group_and_project_ids(self) -> None:
        group_ids = []
        self.project_groups: defaultdict[int, list[Group]] = defaultdict(list)
        for group in self.groups:
            self.project_groups[group.project_id].append(group)
            group_ids.append(group.id)
        self.group_ids = group_ids
        self.project_ids = list(self.project_groups.keys())

    def get_unfetched_events(self) -> list[Event]:
        conditions = []
        if self.last_event is not None:
            conditions.extend(
                [
                    ["timestamp", "<=", self.last_event.timestamp],
                    [
                        ["timestamp", "<", self.last_event.timestamp],
                        ["event_id", "<", self.last_event.event_id],
                    ],
                ]
            )

        events = eventstore.backend.get_unfetched_events(
            filter=eventstore.Filter(
                conditions=conditions, project_ids=self.project_ids, group_ids=self.group_ids
            ),
            limit=self.DEFAULT_CHUNK_SIZE,
            referrer=self.referrer,
            orderby=["-timestamp", "-event_id"],
            tenant_ids=self.tenant_ids,
            dataset=self.dataset,
        )
        return events

    @property
    def tenant_ids(self) -> Mapping[str, Any]:
        result = {"referrer": self.referrer}
        if self.groups:
            result["organization_id"] = self.groups[0].project.organization_id
        return result


class ErrorEventsDeletionTask(EventsBaseDeletionTask):
    """
    Deletes nodestore data, EventAttachment and UserReports for requested groups.

    This class uses the old Snuba deletion method.
    """

    dataset = Dataset.Events

    def chunk(self) -> bool:
        """This method is called to delete chunks of data. It returns a boolean to say
        if the deletion has completed and if it needs to be called again."""
        events = self.get_unfetched_events()
        if events:
            self.delete_events_from_nodestore(events)
            self.delete_dangling_attachments_and_user_reports(events)
            # This value will be used in the next call to chunk
            self.last_event = events[-1]
            # As long as it returns True the task will keep iterating
            return True
        else:
            # Now that all events have been deleted from the eventstore, we can delete the events from snuba
            self.delete_events_from_snuba()
            return False

    def delete_events_from_nodestore(self, events: Sequence[Event]) -> None:
        # Remove from nodestore
        node_ids = [Event.generate_node_id(event.project_id, event.event_id) for event in events]
        nodestore.backend.delete_multi(node_ids)

    def delete_dangling_attachments_and_user_reports(self, events: Sequence[Event]) -> None:
        # Remove EventAttachment and UserReport *again* as those may not have a
        # group ID, therefore there may be dangling ones after "regular" model
        # deletion.
        event_ids = [event.event_id for event in events]
        models.EventAttachment.objects.filter(
            event_id__in=event_ids, project_id__in=self.project_ids
        ).delete()
        models.UserReport.objects.filter(
            event_id__in=event_ids, project_id__in=self.project_ids
        ).delete()

    def delete_events_from_snuba(self) -> None:
        # Remove all group events now that their node data has been removed.
        for project_id, groups in self.project_groups.items():
            group_ids = [group.id for group in groups]
            eventstream_state = eventstream.backend.start_delete_groups(project_id, group_ids)
            eventstream.backend.end_delete_groups(eventstream_state)


class IssuePlatformEventsDeletionTask(EventsBaseDeletionTask):
    """
    This class helps delete Issue Platform events which use the new Clickhouse light deletes.
    """

    dataset = Dataset.IssuePlatform
    # https://github.com/getsentry/snuba/blob/54feb15b7575142d4b3af7f50d2c2c865329f2db/snuba/datasets/configuration/issues/storages/search_issues.yaml#L139
    max_rows_to_delete = 2000000

    def chunk(self) -> bool:
        """This method is called to delete chunks of data. It returns a boolean to say
        if the deletion has completed and if it needs to be called again."""
        events = self.get_unfetched_events()
        if events:
            # Ideally, in some cases, we should also delete the associated event from the Nodestore.
            # In the occurrence_consumer [1] we sometimes create a new event but it's hard in post-ingestion to distinguish between
            # a created event and an existing one.
            # https://github.com/getsentry/sentry/blob/a86b9b672709bc9c4558cffb2c825965b8cee0d1/src/sentry/issues/occurrence_consumer.py#L324-L339
            self.delete_events_from_nodestore(events)
            # This value will be used in the next call to chunk
            self.last_event = events[-1]
            # As long as it returns True the task will keep iterating
            return True
        else:
            # Now that all events have been deleted from the eventstore, we can delete the occurrences from Snuba
            self.delete_events_from_snuba()
            return False

    def delete_events_from_nodestore(self, events: Sequence[Event]) -> None:
        # We delete by the occurrence_id instead of the event_id
        node_ids = [
            Event.generate_node_id(event.project_id, event._snuba_data["occurrence_id"])
            for event in events
        ]
        nodestore.backend.delete_multi(node_ids)

    def delete_events_from_snuba(self) -> None:
        requests = []
        for project_id, groups in self.project_groups.items():
            # Split group_ids into batches where the sum of times_seen is less than max_rows_to_delete
            current_batch: list[int] = []
            current_batch_rows = 0

            # Deterministic sort for sanity, and for very large deletions we'll
            # delete the "smaller" groups first
            groups.sort(key=lambda g: (g.times_seen, g.id))

            for group in groups:
                times_seen = group.times_seen

                # If adding this group would exceed the limit, create a request with the current batch
                if current_batch_rows + times_seen > self.max_rows_to_delete:
                    requests.append(self.delete_request(project_id, current_batch))
                    # We now start a new batch
                    current_batch = [group.id]
                    current_batch_rows = times_seen
                else:
                    current_batch.append(group.id)
                    current_batch_rows += times_seen

            # Add the final batch if it's not empty
            if current_batch:
                requests.append(self.delete_request(project_id, current_batch))

        bulk_snuba_queries(requests)

    def delete_request(self, project_id: int, group_ids: Sequence[int]) -> Request:
        query = DeleteQuery(
            self.dataset.value,
            column_conditions={"project_id": [project_id], "group_id": list(group_ids)},
        )
        return Request(
            dataset=self.dataset.value,
            app_id=self.referrer,
            query=query,
            tenant_ids=self.tenant_ids,
        )


class GroupDeletionTask(ModelDeletionTask[Group]):
    # Delete groups in blocks of 1000. Using 1000 aims to
    # balance the number of snuba replacements with memory limits.
    DEFAULT_CHUNK_SIZE = 1000

    def delete_bulk(self, instance_list: Sequence[Group]) -> bool:
        """
        Group deletion operates as a quasi-bulk operation so that we don't flood
        snuba replacements with deletions per group.
        """
        if not instance_list:
            return True

        self.mark_deletion_in_progress(instance_list)

        error_group_ids = []
        # XXX: If a group type has been removed, we shouldn't error here.
        # Ideally, we should refactor `issue_category` to return None if the type is
        # unregistered.
        for group in instance_list:
            try:
                if group.issue_category == GroupCategory.ERROR:
                    error_group_ids.append(group.id)
            except InvalidGroupTypeError:
                pass
        # Tell seer to delete grouping records with these group hashes
        may_schedule_task_to_delete_hashes_from_seer(error_group_ids)

        self._delete_children(instance_list)

        # Remove group objects with children removed.
        self.delete_instance_bulk(instance_list)

        return False

    def _delete_children(self, instance_list: Sequence[Group]) -> None:
        group_ids = [group.id for group in instance_list]
        # Remove child relations for all groups first.
        child_relations: list[BaseRelation] = []
        for model in _GROUP_RELATED_MODELS:
            child_relations.append(ModelRelation(model, {"group_id__in": group_ids}))

        error_groups, issue_platform_groups = separate_by_group_category(instance_list)

        # If this isn't a retention cleanup also remove event data.
        if not os.environ.get("_SENTRY_CLEANUP"):
            if error_groups:
                params = {"groups": error_groups}
                child_relations.append(BaseRelation(params=params, task=ErrorEventsDeletionTask))

            if issue_platform_groups:
                # This helps creating custom Sentry alerts;
                # remove when #proj-snuba-lightweight_delets is done
                set_tag("issue_platform_deletion", True)
                params = {"groups": issue_platform_groups}
                child_relations.append(
                    BaseRelation(params=params, task=IssuePlatformEventsDeletionTask)
                )

        self.delete_children(child_relations)

    def delete_instance(self, instance: Group) -> None:
        # Similarity module has been removed, skip similarity deletion
        return super().delete_instance(instance)

    def mark_deletion_in_progress(self, instance_list: Sequence[Group]) -> None:
        Group.objects.filter(id__in=[i.id for i in instance_list]).exclude(
            status=GroupStatus.DELETION_IN_PROGRESS
        ).update(status=GroupStatus.DELETION_IN_PROGRESS, substatus=None)


def separate_by_group_category(instance_list: Sequence[Group]) -> tuple[list[Group], list[Group]]:
    error_groups = []
    issue_platform_groups = []
    for group in instance_list:
        try:
            if group.issue_category == GroupCategory.ERROR:
                error_groups.append(group)
                continue
        except InvalidGroupTypeError:
            pass
        # Assume it was an issue platform group if the type is invalid
        issue_platform_groups.append(group)
    return error_groups, issue_platform_groups
