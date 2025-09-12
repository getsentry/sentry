from __future__ import annotations

import logging
import os
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from sentry_sdk import set_tag

from sentry import models
from sentry.deletions.tasks.nodestore import delete_events_for_groups_from_nodestore_and_eventstore
from sentry.issues.grouptype import GroupCategory, InvalidGroupTypeError
from sentry.models.group import Group, GroupStatus
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.tasks.delete_seer_grouping_records import may_schedule_task_to_delete_hashes_from_seer

from ..base import BaseDeletionTask, BaseRelation, ModelDeletionTask, ModelRelation
from ..manager import DeletionTaskManager

logger = logging.getLogger(__name__)

GROUP_CHUNK_SIZE = 100
EVENT_CHUNK_SIZE = 10000

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
    DEFAULT_CHUNK_SIZE = EVENT_CHUNK_SIZE
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

    @property
    def tenant_ids(self) -> Mapping[str, Any]:
        result = {"referrer": self.referrer}
        if self.groups:
            result["organization_id"] = self.groups[0].project.organization_id
        return result

    def chunk(self, apply_filter: bool = False) -> bool:
        """This method is called to delete chunks of data. It returns a boolean to say
        if the deletion has completed and if it needs to be called again."""
        self.delete_events_from_nodestore_and_eventstore()
        return False

    def delete_events_from_nodestore_and_eventstore(self) -> None:
        """Schedule asynchronous deletion of events from the nodestore and eventstore for all groups."""
        if not self.group_ids:
            return

        # Get organization_id from the first group
        organization_id = self.groups[0].project.organization_id

        # Schedule nodestore deletion task for each project
        for project_id, groups in self.project_groups.items():
            sorted_groups = sorted(groups, key=lambda g: (g.times_seen, g.id))
            sorted_group_ids = [group.id for group in sorted_groups]
            sorted_times_seen = [group.times_seen for group in sorted_groups]
            # The scheduled task will not have access to the Group model, thus, we need to pass the times_seen
            # in order to enable proper batching and calling deletions with less than ISSUE_PLATFORM_MAX_ROWS_TO_DELETE
            delete_events_for_groups_from_nodestore_and_eventstore.apply_async(
                kwargs={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "group_ids": sorted_group_ids,
                    "times_seen": sorted_times_seen,
                    "transaction_id": self.transaction_id,
                    "dataset_str": self.dataset.value,
                    "referrer": self.referrer,
                },
            )


class ErrorEventsDeletionTask(EventsBaseDeletionTask):
    """
    Deletes nodestore data, EventAttachment and UserReports for requested groups.

    This class uses the old Snuba deletion method.
    """

    dataset = Dataset.Events


class IssuePlatformEventsDeletionTask(EventsBaseDeletionTask):
    """
    This class helps delete Issue Platform events which use the new Clickhouse light deletes.
    """

    dataset = Dataset.IssuePlatform


class GroupDeletionTask(ModelDeletionTask[Group]):
    # Delete groups in blocks of GROUP_CHUNK_SIZE. Using GROUP_CHUNK_SIZE aims to
    # balance the number of snuba replacements with memory limits.
    DEFAULT_CHUNK_SIZE = GROUP_CHUNK_SIZE

    def delete_bulk(self, instance_list: Sequence[Group]) -> bool:
        """
        Group deletion operates as a quasi-bulk operation so that we don't flood
        snuba replacements with deletions per group.
        """
        print("GroupDeletionTask.delete_bulk")
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
        print("GroupDeletionTask._delete_children")
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
        print("GroupDeletionTask.delete_instance")
        from sentry import similarity

        if not self.skip_models or similarity not in self.skip_models:
            similarity.delete(None, instance)

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
