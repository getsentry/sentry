from __future__ import annotations

import logging
import os
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any, TypeGuard

from sentry import models, options
from sentry.deletions.tasks.nodestore import delete_events_for_groups_from_nodestore_and_eventstore
from sentry.issues.grouptype import GroupCategory, InvalidGroupTypeError, get_group_type_by_type_id
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

# These fields are to reduce how much data we fetch from the database.
FIELDS_TO_FETCH = ["id", "project_id", "times_seen", "type", "project__organization_id"]
_F_IDX = {field: index for index, field in enumerate(FIELDS_TO_FETCH)}
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


def _is_group_sequence(groups: Sequence[Group | tuple[Any, ...]]) -> TypeGuard[Sequence[Group]]:
    """Type guard to narrow Sequence[Group | tuple] to Sequence[Group]."""
    return all(isinstance(group, Group) for group in groups)


class EventsBaseDeletionTask(BaseDeletionTask[Group]):
    """
    Base class to delete events associated to groups and its related models.
    """

    # Number of events fetched from eventstore per chunk() call.
    DEFAULT_CHUNK_SIZE = EVENT_CHUNK_SIZE
    referrer = "deletions.group"
    dataset: Dataset

    def __init__(
        self, manager: DeletionTaskManager, groups: Sequence[Group | tuple[Any, ...]], **kwargs: Any
    ) -> None:
        # Use self.last_event to keep track of the last event processed in the chunk method.
        self.last_event: Event | None = None
        self.set_group_and_project_ids(groups)
        super().__init__(manager, **kwargs)

    def set_group_and_project_ids(self, groups: Sequence[Group | tuple[Any, ...]]) -> None:
        # Deletion tasks always belong to the same organization.
        if not groups:
            self.organization_id = None
        elif isinstance(groups[0], Group):
            self.organization_id = groups[0].project.organization_id
        else:
            self.organization_id = groups[0][_F_IDX["project__organization_id"]]

        self.project_groups: defaultdict[int, list[Group | tuple[Any, ...]]] = defaultdict(list)
        for group in groups:
            if isinstance(group, Group):
                self.project_groups[group.project_id].append(group)
            else:
                self.project_groups[group[_F_IDX["project_id"]]].append(group)

    @property
    def tenant_ids(self) -> Mapping[str, Any]:
        result = {"referrer": self.referrer}
        if self.organization_id:
            result["organization_id"] = self.organization_id
        return result

    def chunk(self, apply_filter: bool = False) -> bool:
        """This method is called to delete chunks of data. It returns a boolean to say
        if the deletion has completed and if it needs to be called again."""
        self.delete_events_from_nodestore_and_eventstore()
        return False

    def delete_events_from_nodestore_and_eventstore(self) -> None:
        """Schedule asynchronous deletion of events from the nodestore and eventstore for all groups."""
        if not self.project_groups:
            return

        # Schedule nodestore deletion task for each project
        for project_id, groups in self.project_groups.items():
            if _is_group_sequence(groups):
                sorted_groups = sorted(groups, key=lambda g: (g.times_seen, g.id))
                sorted_group_ids = [group.id for group in sorted_groups]
                sorted_times_seen = [group.times_seen for group in sorted_groups]
            else:
                # groups must be list[tuple[Any, ...]]
                tuple_groups: list[tuple[Any, ...]] = groups  # type: ignore[assignment]
                times_seen_index = _F_IDX["times_seen"]
                id_index = _F_IDX["id"]
                sorted_tuple_groups = sorted(
                    tuple_groups,
                    key=lambda g: (g[times_seen_index], g[id_index]),
                )
                sorted_group_ids = [group[id_index] for group in sorted_tuple_groups]
                sorted_times_seen = [group[times_seen_index] for group in sorted_tuple_groups]
            # The scheduled task will not have access to the Group model, thus, we need to pass the times_seen
            # in order to enable proper batching and calling deletions with less than ISSUE_PLATFORM_MAX_ROWS_TO_DELETE
            delete_events_for_groups_from_nodestore_and_eventstore.apply_async(
                kwargs={
                    "organization_id": self.organization_id,
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

    def chunk(self, apply_filter: bool = False) -> bool:
        """
        Deletes a chunk of this instance's data. Return ``True`` if there is
        more work, or ``False`` if all matching entities have been removed.
        """
        query_limit = self.query_limit
        remaining = self.chunk_size
        query = self.query
        order_by = self.order_by

        while remaining > 0:
            queryset = getattr(self.model, self.manager_name).filter(**query)

            if apply_filter:
                query_filter = self.get_query_filter()
                if query_filter is not None:
                    queryset = queryset.filter(query_filter)

            if self.order_by:
                queryset = queryset.order_by(order_by)

            if options.get("deletions.fetch-subset-of-fields"):
                # This reduces the number of fields fetched from the database
                queryset = list(queryset.values_list(*FIELDS_TO_FETCH)[:query_limit])
            else:
                queryset = list(queryset[:query_limit])

            if not queryset:
                return False

            self.delete_bulk(queryset)
            remaining = remaining - len(queryset)
        return True

    def delete_bulk(self, instance_list: Sequence[Group | tuple[Any, ...]]) -> bool:
        """
        Group deletion operates as a quasi-bulk operation so that we don't flood
        snuba replacements with deletions per group.
        """
        if not instance_list:
            return True

        self.mark_deletion_in_progress(instance_list)
        self._delete_children(instance_list)
        # Remove group objects with children removed.
        # If instances are tuples, convert them to Group objects for deletion
        if _is_group_sequence(instance_list):
            self.delete_instance_bulk(instance_list)
        else:
            # Convert tuples to Group objects
            tuple_list: Sequence[tuple[Any, ...]] = instance_list  # type: ignore[assignment]
            group_ids = [group[_F_IDX["id"]] for group in tuple_list]
            groups = list(Group.objects.filter(id__in=group_ids))
            self.delete_instance_bulk(groups)

        return False

    def _delete_children(self, instance_list: Sequence[Group | tuple[Any, ...]]) -> None:
        if not instance_list:
            return

        if _is_group_sequence(instance_list):
            group_ids = [group.id for group in instance_list]
            project_id = instance_list[0].project_id
        else:
            tuple_list: Sequence[tuple[Any, ...]] = instance_list  # type: ignore[assignment]
            group_ids = [group[_F_IDX["id"]] for group in tuple_list]
            project_id = tuple_list[0][_F_IDX["project_id"]]

        # Remove child relations for all groups first.
        child_relations: list[BaseRelation] = []
        for model in _GROUP_RELATED_MODELS:
            child_relations.append(ModelRelation(model, {"group_id__in": group_ids}))

        error_groups, issue_platform_groups = separate_by_group_category(instance_list)
        if _is_group_sequence(error_groups) and _is_group_sequence(issue_platform_groups):
            error_group_ids = [group.id for group in error_groups]
            issue_platform_group_ids = [group.id for group in issue_platform_groups]
        else:
            error_tuple_groups: list[tuple[Any, ...]] = error_groups  # type: ignore[assignment]
            issue_platform_tuple_groups: list[tuple[Any, ...]] = issue_platform_groups  # type: ignore[assignment]
            error_group_ids = [group[_F_IDX["id"]] for group in error_tuple_groups]
            issue_platform_group_ids = [
                group[_F_IDX["id"]] for group in issue_platform_tuple_groups
            ]

        delete_group_hashes(project_id, error_group_ids, seer_deletion=True)
        delete_group_hashes(project_id, issue_platform_group_ids)

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

    def delete_instance(self, instance: Group | tuple[Any, ...]) -> None:
        from sentry import similarity

        if isinstance(instance, tuple):
            instance = Group.objects.get(id=instance[_F_IDX["id"]])

        if not self.skip_models or similarity not in self.skip_models:
            similarity.delete(None, instance)

        return super().delete_instance(instance)

    def mark_deletion_in_progress(self, instance_list: Sequence[Group | tuple[Any, ...]]) -> None:
        if _is_group_sequence(instance_list):
            group_ids = [group.id for group in instance_list]
        else:
            tuple_list: Sequence[tuple[Any, ...]] = instance_list  # type: ignore[assignment]
            group_ids = [group[_F_IDX["id"]] for group in tuple_list]
        Group.objects.filter(id__in=group_ids).exclude(
            status=GroupStatus.DELETION_IN_PROGRESS
        ).update(status=GroupStatus.DELETION_IN_PROGRESS, substatus=None)


def delete_project_group_hashes(project_id: int) -> None:
    groups: list[Group] = []
    for group in RangeQuerySetWrapper(
        Group.objects.filter(project_id=project_id), step=GROUP_CHUNK_SIZE
    ):
        groups.append(group)

    error_groups, issue_platform_groups = separate_by_group_category(groups)
    # Since groups are all Group objects, the separated groups should also be Group objects
    if _is_group_sequence(error_groups):
        error_group_ids = [group.id for group in error_groups]
    else:
        tuple_groups: list[tuple[Any, ...]] = error_groups  # type: ignore[assignment]
        error_group_ids = [group[_F_IDX["id"]] for group in tuple_groups]
    delete_group_hashes(project_id, error_group_ids, seer_deletion=True)

    if _is_group_sequence(issue_platform_groups):
        issue_platform_group_ids = [group.id for group in issue_platform_groups]
    else:
        tuple_issue_platform_groups: list[tuple[Any, ...]] = issue_platform_groups  # type: ignore[assignment]
        issue_platform_group_ids = [group[_F_IDX["id"]] for group in tuple_issue_platform_groups]
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
            GroupHashMetadata.objects.filter(grouphash_id__in=hash_ids).delete()
            GroupHash.objects.filter(id__in=hash_ids).delete()

        iterations += 1

    if iterations == GROUP_HASH_ITERATIONS:
        metrics.incr("deletions.group_hashes.max_iterations_reached", sample_rate=1.0)
        logger.warning(
            "Group hashes batch deletion reached the maximum number of iterations. "
            "Investigate if we need to change the GROUP_HASH_ITERATIONS value."
        )


def separate_by_group_category(
    instance_list: Sequence[Group | tuple[Any, ...]],
) -> tuple[list[Group | tuple[Any, ...]], list[Group | tuple[Any, ...]]]:
    error_groups: list[Group | tuple[Any, ...]] = []
    issue_platform_groups: list[Group | tuple[Any, ...]] = []

    # Return early if the list is empty
    if not instance_list:
        return error_groups, issue_platform_groups

    for group in instance_list:
        # XXX: If a group type has been removed, we shouldn't error here.
        # Ideally, we should refactor `issue_category` to return None if the type is
        # unregistered.
        try:
            if isinstance(group, Group):
                issue_category = group.issue_category
            else:
                # See issue_type() and issue_category() in group.py
                issue_category = GroupCategory(
                    get_group_type_by_type_id(group[_F_IDX["type"]]).category
                )

            if issue_category == GroupCategory.ERROR:
                error_groups.append(group)
                continue
        except InvalidGroupTypeError:
            pass
        # Assume it was an issue platform group if the type is invalid
        issue_platform_groups.append(group)
    return error_groups, issue_platform_groups
