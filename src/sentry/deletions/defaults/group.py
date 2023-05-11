import os
from collections import defaultdict

from sentry import eventstore, eventstream, models, nodestore
from sentry.eventstore.models import Event

from ..base import BaseDeletionTask, BaseRelation, ModelDeletionTask, ModelRelation

# Group models that relate only to groups and not to events. We assume those to
# be safe to delete/mutate within a single transaction for user-triggered
# actions (delete/reprocess/merge/unmerge)
DIRECT_GROUP_RELATED_MODELS = (
    models.GroupHash,
    models.GroupAssignee,
    models.GroupCommitResolution,
    models.GroupLink,
    models.GroupHistory,
    models.GroupBookmark,
    models.GroupMeta,
    models.GroupEnvironment,
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
    models.RuleFireHistory,
)

_GROUP_RELATED_MODELS = DIRECT_GROUP_RELATED_MODELS + (
    # prioritize GroupHash
    models.UserReport,
    models.EventAttachment,
)


class EventDataDeletionTask(BaseDeletionTask):
    """
    Deletes nodestore data, EventAttachment and UserReports for group
    """

    # Number of events fetched from eventstore per chunk() call.
    DEFAULT_CHUNK_SIZE = 10000

    def __init__(self, manager, groups, **kwargs):
        self.groups = groups
        self.last_event = None
        super().__init__(manager, **kwargs)

    def chunk(self):
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

        group_ids = []
        project_groups = defaultdict(list)
        for group in self.groups:
            project_groups[group.project_id].append(group.id)
            group_ids.append(group.id)
        project_ids = list(project_groups.keys())

        events = eventstore.get_unfetched_events(
            filter=eventstore.Filter(
                conditions=conditions, project_ids=project_ids, group_ids=group_ids
            ),
            limit=self.DEFAULT_CHUNK_SIZE,
            referrer="deletions.group",
            orderby=["-timestamp", "-event_id"],
            tenant_ids={"organization_id": self.groups[0].project.organization_id}
            if self.groups
            else None,
        )
        if not events:
            # Remove all group events now that their node data has been removed.
            for project_id, group_ids in project_groups.items():
                eventstream_state = eventstream.start_delete_groups(project_id, group_ids)
                eventstream.end_delete_groups(eventstream_state)
            return False

        self.last_event = events[-1]

        # Remove from nodestore
        node_ids = [Event.generate_node_id(event.project_id, event.event_id) for event in events]
        nodestore.delete_multi(node_ids)

        # Remove EventAttachment and UserReport *again* as those may not have a
        # group ID, therefore there may be dangling ones after "regular" model
        # deletion.
        event_ids = [event.event_id for event in events]
        models.EventAttachment.objects.filter(
            event_id__in=event_ids, project_id__in=project_ids
        ).delete()
        models.UserReport.objects.filter(
            event_id__in=event_ids, project_id__in=project_ids
        ).delete()

        return True


class GroupDeletionTask(ModelDeletionTask):
    # Delete groups in blocks of 1000. Using 1000 aims to
    # balance the number of snuba replacements with memory limits.
    DEFAULT_CHUNK_SIZE = 1000

    def delete_bulk(self, instance_list):
        """
        Group deletion operates as a quasi-bulk operation so that we don't flood
        snuba replacements with deletions per group.
        """
        self.mark_deletion_in_progress(instance_list)

        group_ids = [group.id for group in instance_list]

        # Remove child relations for all groups first.
        child_relations = []
        for model in _GROUP_RELATED_MODELS:
            child_relations.append(ModelRelation(model, {"group_id__in": group_ids}))

        # If this isn't a retention cleanup also remove event data.
        if not os.environ.get("_SENTRY_CLEANUP"):
            child_relations.append(
                BaseRelation(params={"groups": instance_list}, task=EventDataDeletionTask)
            )

        self.delete_children(child_relations)

        # Remove group objects with children removed.
        return self.delete_instance_bulk(instance_list)

    def delete_instance(self, instance):
        from sentry import similarity

        if not self.skip_models or similarity not in self.skip_models:
            similarity.delete(None, instance)

        return super().delete_instance(instance)

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import Group, GroupStatus

        Group.objects.filter(id__in=[i.id for i in instance_list]).exclude(
            status=GroupStatus.DELETION_IN_PROGRESS
        ).update(status=GroupStatus.DELETION_IN_PROGRESS, substatus=None)
