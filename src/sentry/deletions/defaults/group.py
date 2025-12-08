"""
Group deletion configuration.

This module defines which models should be deleted when a group is deleted and how
they should be handled during reprocessing operations.

IMPORTANT: When adding a new model with a group_id foreign key, you MUST add it to
one of the model lists below, or tests will fail. See:
  - tests/sentry/deletions/test_validate_group_related_models.py

For guidance on which list to use, see the comments on DIRECT_GROUP_RELATED_MODELS
and ADDITIONAL_GROUP_RELATED_MODELS below.
"""

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

from ..base import BaseDeletionTask, BaseRelation, ModelDeletionTask, ModelRelation
from ..manager import DeletionTaskManager

logger = logging.getLogger(__name__)

GROUP_CHUNK_SIZE = 100
EVENT_CHUNK_SIZE = 10000
GROUP_HASH_ITERATIONS = 10000
GROUP_HASH_METADATA_ITERATIONS = 10000

# Group models that relate only to groups and not to events. These models are
# transferred during reprocessing operations because they represent group-level
# metadata that should follow the group when events are reprocessed.
#
# Add a model to this list if it meets ALL of these criteria:
# 1. NO event_id field - represents group state, not individual event data
# 2. Should be TRANSFERRED during reprocessing - the metadata is about the group itself
#    (e.g., assignments, bookmarks, resolutions, history) and should move with it
# 3. Safe to bulk update with group_id changes during merge/unmerge operations
DIRECT_GROUP_RELATED_MODELS = (
    # prioritize GroupHash
    # XXX: We could remove GroupHash from here since we call delete_group_hashes() in the _delete_children() method.
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
    models.GroupReaction,
    models.Activity,
    RuleFireHistory,
)

# Additional group-related models that require special handling during reprocessing.
# Unlike DIRECT_GROUP_RELATED_MODELS which are migrated in bulk, these models need
# per-event processing or should not be transferred at all.
#
# Add a model to this list if it meets ANY of these criteria:
# 1. Has an event_id field - per-event data that must be migrated during event
#    reprocessing pipeline, not as a group bulk operation (UserReport, EventAttachment)
# 2. Should NOT be transferred during reprocessing - transient or notification data
#    that doesn't represent core group state (NotificationMessage)
ADDITIONAL_GROUP_RELATED_MODELS = (
    models.UserReport,
    models.EventAttachment,
    NotificationMessage,
)
_GROUP_RELATED_MODELS = DIRECT_GROUP_RELATED_MODELS + ADDITIONAL_GROUP_RELATED_MODELS


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
        project_id = instance_list[0].project_id  # All groups should have same project_id
        # Remove child relations for all groups first.
        child_relations: list[BaseRelation] = []
        for model in _GROUP_RELATED_MODELS:
            if model == models.GroupHash:
                # Using the composite index on (project_id, group_id) is very efficient compared to
                # using the index on group_id alone. This index only shows up in production.
                # XXX: Follow up with a PR to add this composite index
                child_relations.append(
                    ModelRelation(model, {"project_id": project_id, "group_id__in": group_ids})
                )
            else:
                child_relations.append(ModelRelation(model, {"group_id__in": group_ids}))

        error_groups, issue_platform_groups = separate_by_group_category(instance_list)
        error_group_ids = [group.id for group in error_groups]
        issue_platform_group_ids = [group.id for group in issue_platform_groups]

        # delete_children() will delete GroupHash rows and related GroupHashMetadata rows,
        # however, we have added multiple optimizations in this function that would need to
        # be ported to a custom deletion task.
        delete_project_group_hashes(
            instance_list[0].project_id, group_ids_filter=error_group_ids, seer_deletion=True
        )
        delete_project_group_hashes(
            instance_list[0].project_id, group_ids_filter=issue_platform_group_ids
        )

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


def update_group_hash_metadata_in_batches(hash_ids: Sequence[int]) -> None:
    """
    Update seer_matched_grouphash to None for GroupHashMetadata rows
    that reference the given hash_ids, in batches to avoid timeouts.

    This function performs the update in smaller batches to reduce lock
    contention and prevent statement timeouts when many rows need updating.
    Includes a maximum iteration limit as a safeguard against potential
    infinite loops.
    """
    option_batch_size = options.get("deletions.group-hash-metadata.batch-size")
    batch_size = max(1, option_batch_size)

    # Process rows in batches with a maximum iteration limit to prevent
    # infinite loops while still allowing processing of large datasets.
    updated_rows = 0
    iteration_count = 0
    while iteration_count < GROUP_HASH_METADATA_ITERATIONS:
        iteration_count += 1
        # Note: hash_ids is bounded to ~100 items (deletions.group-hashes-batch-size)
        # from the caller, so this IN clause is intentionally not batched
        batch_metadata_ids = list(
            GroupHashMetadata.objects.filter(seer_matched_grouphash_id__in=hash_ids).values_list(
                "id", flat=True
            )[:batch_size]
        )
        if not batch_metadata_ids:
            break

        updated = GroupHashMetadata.objects.filter(id__in=batch_metadata_ids).update(
            seer_matched_grouphash=None
        )
        updated_rows += updated
        metrics.incr("deletions.group_hash_metadata.rows_updated", amount=updated, sample_rate=1.0)
        # It could be possible we could be trying to update the same rows again and again,
        # thus, let's break the loop.
        if updated == 0:
            break

    # We will try again these hash_ids on the next run of the cleanup script.
    # This is a safeguard to prevent infinite loops.
    if iteration_count >= GROUP_HASH_METADATA_ITERATIONS:
        logger.warning(
            "update_group_hash_metadata_in_batches.max_iterations_reached",
            extra={"updated_rows": updated_rows},
        )
        metrics.incr("deletions.group_hash_metadata.max_iterations_reached", sample_rate=1.0)


def delete_project_group_hashes(
    project_id: int,
    group_ids_filter: Sequence[int] | None = None,
    seer_deletion: bool = False,
) -> None:
    """
    Delete GroupHash records for a project.

    This is the main function for deleting GroupHash records. It can delete all hashes for a project
    (used during project deletion to clean up orphaned records) or delete hashes for specific groups
    (used during group deletion).

    Args:
        project_id: The project to delete hashes for
        group_ids_filter: Optional filter for specific group IDs.
                         - If None: deletes ALL GroupHash records for the project (including orphans)
                         - If empty: returns immediately (no-op for safety)
                         - If non-empty: deletes only hashes for those specific groups
        seer_deletion: Whether to notify Seer about the deletion
    """
    # Safety: empty filter means nothing to delete
    if group_ids_filter is not None and len(group_ids_filter) == 0:
        return

    hashes_batch_size = max(1, options.get("deletions.group-hashes-batch-size"))

    iterations = 0
    while iterations < GROUP_HASH_ITERATIONS:
        # Base query: all hashes for this project
        qs = GroupHash.objects.filter(project_id=project_id)

        # Apply group filter if provided
        if group_ids_filter is not None:
            qs = qs.filter(group_id__in=group_ids_filter)

        hashes_chunk = list(qs.values_list("id", "hash")[:hashes_batch_size])
        if not hashes_chunk:
            break
        try:
            if seer_deletion:
                hash_values = [gh[1] for gh in hashes_chunk]
                may_schedule_task_to_delete_hashes_from_seer(project_id, hash_values)
        except Exception:
            logger.warning("Error scheduling task to delete hashes from seer")
        finally:
            hash_ids = [gh[0] for gh in hashes_chunk]
            update_group_hash_metadata_in_batches(hash_ids)
            GroupHashMetadata.objects.filter(grouphash_id__in=hash_ids).delete()
            GroupHash.objects.filter(id__in=hash_ids).delete()

        iterations += 1

    if iterations == GROUP_HASH_ITERATIONS:
        metrics.incr("deletions.group_hashes.max_iterations_reached", sample_rate=1.0)
        logger.warning(
            "delete_group_hashes.max_iterations_reached",
            extra={"project_id": project_id, "filtered": group_ids_filter is not None},
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
