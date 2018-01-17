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
        from sentry.models import GroupStatus

        for instance in instance_list:
            if instance.status != GroupStatus.DELETION_IN_PROGRESS:
                instance.update(status=GroupStatus.DELETION_IN_PROGRESS)
