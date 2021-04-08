import os

from sentry import eventstore, models, nodestore
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

    DEFAULT_CHUNK_SIZE = 10000

    def __init__(self, manager, group_id, project_id, **kwargs):
        self.group_id = group_id
        self.project_id = project_id
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

        events = eventstore.get_unfetched_events(
            filter=eventstore.Filter(
                conditions=conditions, project_ids=[self.project_id], group_ids=[self.group_id]
            ),
            limit=self.DEFAULT_CHUNK_SIZE,
            referrer="deletions.group",
            orderby=["-timestamp", "-event_id"],
        )

        if not events:
            return False

        self.last_event = events[-1]

        # Remove from nodestore
        node_ids = [Event.generate_node_id(self.project_id, event.event_id) for event in events]
        nodestore.delete_multi(node_ids)

        # Remove EventAttachment and UserReport *again* as those may not have a
        # group ID, therefore there may be dangling ones after "regular" model
        # deletion.
        event_ids = [event.event_id for event in events]
        models.EventAttachment.objects.filter(
            event_id__in=event_ids, project_id=self.project_id
        ).delete()
        models.UserReport.objects.filter(
            event_id__in=event_ids, project_id=self.project_id
        ).delete()

        return True


class GroupDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):

        relations = []

        relations.extend(
            [ModelRelation(m, {"group_id": instance.id}) for m in _GROUP_RELATED_MODELS]
        )

        # Skip EventDataDeletionTask if this is being called from cleanup.py
        if not os.environ.get("_SENTRY_CLEANUP"):
            relations.extend(
                [
                    BaseRelation(
                        {"group_id": instance.id, "project_id": instance.project_id},
                        EventDataDeletionTask,
                    )
                ]
            )

        return relations

    def delete_instance(self, instance):
        from sentry import similarity

        if not self.skip_models or similarity not in self.skip_models:
            similarity.delete(None, instance)

        return super().delete_instance(instance)

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import Group, GroupStatus

        Group.objects.filter(id__in=[i.id for i in instance_list]).exclude(
            status=GroupStatus.DELETION_IN_PROGRESS
        ).update(status=GroupStatus.DELETION_IN_PROGRESS)
