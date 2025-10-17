from __future__ import annotations

import logging
import os
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from sentry import models, options
from sentry.deletions.tasks.nodestore import delete_events_for_groups_from_nodestore_and_eventstore
from sentry.issues.grouptype import GroupCategory, InvalidGroupTypeError
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.tasks.delete_seer_grouping_records import may_schedule_task_to_delete_hashes_from_seer
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper

from ..base import BaseDeletionTask, BaseRelation, ModelDeletionTask, ModelRelation
from ..manager import DeletionTaskManager

logger = logging.getLogger(__name__)

GROUP_CHUNK_SIZE = 100
EVENT_CHUNK_SIZE = 10000
GROUP_HASH_ITERATIONS = 10000


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
        if not instance_list:
            return True

        self.mark_deletion_in_progress(instance_list)
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
        error_group_ids = [group.id for group in error_groups]
        issue_platform_group_ids = [group.id for group in issue_platform_groups]

        delete_group_hashes(instance_list[0].project_id, error_group_ids, seer_deletion=True)
        delete_group_hashes(instance_list[0].project_id, issue_platform_group_ids)

        # If this isn't a retention cleanup also remove event data.
        if not os.environ.get("_SENTRY_CLEANUP"):
            if error_groups:
                params = {"groups": error_groups}
                child_relations.append(BaseRelation(params=params, task=ErrorEventsDeletionTask))

            if issue_platform_groups:
                params = {"groups": issue_platform_groups}
                child_relations.append(
                    BaseRelation(params=params, task=IssuePlatformEventsDeletionTask)
                )

        self.delete_children(child_relations)

    def delete_instance(self, instance: Group) -> None:
        from sentry import similarity

        if not self.skip_models or similarity not in self.skip_models:
            similarity.delete(None, instance)

        return super().delete_instance(instance)

    def mark_deletion_in_progress(self, instance_list: Sequence[Group]) -> None:
        Group.objects.filter(id__in=[i.id for i in instance_list]).exclude(
            status=GroupStatus.DELETION_IN_PROGRESS
        ).update(status=GroupStatus.DELETION_IN_PROGRESS, substatus=None)


def delete_project_group_hashes(project_id: int) -> None:
    groups = []
    for group in RangeQuerySetWrapper(
        Group.objects.filter(project_id=project_id), step=GROUP_CHUNK_SIZE
    ):
        groups.append(group)

    error_groups, issue_platform_groups = separate_by_group_category(groups)
    error_group_ids = [group.id for group in error_groups]
    delete_group_hashes(project_id, error_group_ids, seer_deletion=True)

    issue_platform_group_ids = [group.id for group in issue_platform_groups]
    delete_group_hashes(project_id, issue_platform_group_ids)


def delete_group_hashes(
    project_id: int,
    group_ids: Sequence[int],
    seer_deletion: bool = False,
) -> None:
    # Validate batch size to ensure it's at least 1 to avoid ValueError in range()
    hashes_batch_size = max(1, options.get("deletions.group-hashes-batch-size"))

    # Set a reasonable upper bound on iterations to prevent infinite loops.
    # The loop will naturally terminate when no more hashes are found.
    iterations = 0
    while iterations < GROUP_HASH_ITERATIONS:
        qs = GroupHash.objects.filter(project_id=project_id, group_id__in=group_ids).values_list(
            "id", "hash"
        )[:hashes_batch_size]
        hashes_chunk = list(qs)
        if not hashes_chunk:
            break
        try:
            if seer_deletion:
                # Tell seer to delete grouping records for these groups
                # It's low priority to delete the hashes from seer, so we don't want
                # any network errors to block the deletion of the groups
                hash_values = [gh[1] for gh in hashes_chunk]
                may_schedule_task_to_delete_hashes_from_seer(project_id, hash_values)
        except Exception:
            logger.warning("Error scheduling task to delete hashes from seer")
        finally:
            hash_ids = [gh[0] for gh in hashes_chunk]
            if options.get("deletions.group.delete_group_hashes_metadata_first"):
                # If we delete the grouphash metadata rows first we will not need to update the references to the other grouphashes.
                # If we try to delete the group hashes first, then it will require the updating of the columns first.
                #
                # To understand this, let's say we have the following relationships:
                # gh A -> ghm A -> no reference to another grouphash
                # gh B -> ghm B -> gh C
                # gh C -> ghm C -> gh A
                #
                # Deleting group hashes A, B & C (since they all point to the same group) will require:
                # * Updating columns ghmB & ghmC to point to None
                # * Deleting the group hash metadata rows
                # * Deleting the group hashes
                #
                # If we delete the metadata first, we will not need to update the columns before deleting them.
                try:
                    GroupHashMetadata.objects.filter(grouphash_id__in=hash_ids).delete()
                except Exception:
                    # XXX: Let's make sure that no issues are caused by this and then remove it
                    logger.exception("Error deleting group hash metadata")

            GroupHash.objects.filter(id__in=hash_ids).delete()

        iterations += 1

    if iterations == GROUP_HASH_ITERATIONS:
        metrics.incr("deletions.group_hashes.max_iterations_reached", sample_rate=1.0)
        logger.warning(
            "Group hashes batch deletion reached the maximum number of iterations. "
            "Investigate if we need to change the GROUP_HASH_ITERATIONS value."
        )


def separate_by_group_category(instance_list: Sequence[Group]) -> tuple[list[Group], list[Group]]:
    error_groups = []
    issue_platform_groups = []
    for group in instance_list:
        # XXX: If a group type has been removed, we shouldn't error here.
        # Ideally, we should refactor `issue_category` to return None if the type is
        # unregistered.
        try:
            if group.issue_category == GroupCategory.ERROR:
                error_groups.append(group)
                continue
        except InvalidGroupTypeError:
            pass
        # Assume it was an issue platform group if the type is invalid
        issue_platform_groups.append(group)
    return error_groups, issue_platform_groups
