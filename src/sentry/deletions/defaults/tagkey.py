from __future__ import absolute_import, print_function

from ..base import ModelDeletionTask, ModelRelation


class TagKeyDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import (EventTag, GroupTagKey, GroupTagValue, TagValue)

        # in bulk
        model_list = (GroupTagValue, GroupTagKey, TagValue)
        relations = [
            ModelRelation(m, {
                'project_id': instance.project_id,
                'key': instance.key,
            }) for m in model_list
        ]
        relations.append(
            ModelRelation(EventTag, {
                'project_id': instance.project_id,
                'key_id': instance.id,
            })
        )
        return relations

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import TagKeyStatus

        for instance in instance_list:
            if instance.status != TagKeyStatus.DELETION_IN_PROGRESS:
                instance.update(status=TagKeyStatus.DELETION_IN_PROGRESS)
