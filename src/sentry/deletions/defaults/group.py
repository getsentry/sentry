from __future__ import absolute_import, print_function

from ..base import ModelDeletionTask, ModelRelation


class GroupDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry import models

        relations = []

        model_list = (
            # prioritize GroupHash
            models.GroupHash,
            models.EventMapping,
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
            models.GroupEmailThread,
            models.GroupSubscription,
            models.UserReport,
            models.EventAttachment,
            # Event is last as its the most time consuming
            models.Event,
        )

        relations.extend([ModelRelation(m, {'group_id': instance.id}) for m in model_list])

        return relations

    def delete_instance(self, instance):
        from sentry.similarity import features

        if not self.skip_models or features not in self.skip_models:
            features.delete(instance)

        return super(GroupDeletionTask, self).delete_instance(instance)

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import Group, GroupStatus

        in_progress = Group.objects.filter(
            id__in=[i.id for i in instance_list]
        ).exclude(status=GroupStatus.DELETION_IN_PROGRESS)
        in_progress.update(status=GroupStatus.DELETION_IN_PROGRESS)
