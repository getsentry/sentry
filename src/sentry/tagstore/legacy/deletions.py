"""
sentry.tagstore.legacy.deletions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from sentry.deletions.base import ModelDeletionTask, ModelRelation


class TagKeyDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from .models import (GroupTagKey, GroupTagValue, TagValue)

        # in bulk
        model_list = (GroupTagValue, GroupTagKey, TagValue)
        relations = [
            ModelRelation(m, {
                'project_id': instance.project_id,
                'key': instance.key,
            }) for m in model_list
        ]
        return relations

    def mark_deletion_in_progress(self, instance_list):
        from sentry.tagstore import TagKeyStatus

        for instance in instance_list:
            if instance.status != TagKeyStatus.DELETION_IN_PROGRESS:
                instance.update(status=TagKeyStatus.DELETION_IN_PROGRESS)
