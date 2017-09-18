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
            models.GroupBookmark,
            models.GroupMeta,
            models.GroupRelease,
            models.GroupRedirect,
            models.GroupResolution,
            models.GroupSnooze,
            models.GroupTagKey,
            models.GroupSubscription,
            models.UserReport,
        )

        # these are manually handled by the cleanup script
        if not self.cleanup:
            model_list += [
                models.GroupEmailThread,
                models.GroupRuleStatus,
                models.GroupTagValue,
                models.EventTag,
                # Event is last as its the most time consuming
                models.Event,
            ]

        relations.extend([ModelRelation(m, {'group_id': instance.id}) for m in model_list])

        return relations

    def delete_instance(self, instance):
        if not self.cleanup:
            from sentry.similarity import features
            features.delete(instance)

        return super(GroupDeletionTask, self).delete_instance(instance)

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import GroupStatus

        for instance in instance_list:
            if instance.status != GroupStatus.DELETION_IN_PROGRESS:
                instance.update(status=GroupStatus.DELETION_IN_PROGRESS)
