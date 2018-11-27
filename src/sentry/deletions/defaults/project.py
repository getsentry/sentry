from __future__ import absolute_import, print_function

from ..base import (BulkModelDeletionTask, ModelDeletionTask, ModelRelation)


class ProjectDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry import models

        relations = [
            # ProjectKey gets revoked immediately, in bulk
            ModelRelation(models.ProjectKey, {'project_id': instance.id})
        ]

        # in bulk
        model_list = (
            models.Activity, models.EnvironmentProject, models.EventAttachment, models.EventMapping,
            models.EventUser, models.GroupAssignee, models.GroupBookmark, models.GroupEmailThread,
            models.GroupHash, models.GroupRelease, models.GroupRuleStatus, models.GroupSeen,
            models.GroupShare, models.GroupSubscription, models.ProjectBookmark, models.ProjectKey,
            models.ProjectTeam, models.PromptsActivity, models.SavedSearchUserDefault, models.SavedSearch,
            models.ServiceHook, models.UserReport, models.DiscoverSavedQueryProject,
        )

        relations.extend(
            [
                ModelRelation(m, {'project_id': instance.id}, BulkModelDeletionTask)
                for m in model_list
            ]
        )

        model_list = (models.GroupMeta, models.GroupResolution, models.GroupSnooze, )
        relations.extend(
            [
                ModelRelation(m, {'group__project': instance.id}, ModelDeletionTask)
                for m in model_list
            ]
        )

        # special case event due to nodestore
        relations.extend([ModelRelation(models.Event, {'project_id': instance.id})])

        # in bulk
        # Release needs to handle deletes after Group is cleaned up as the foreign
        # key is protected
        model_list = (models.Group, models.ReleaseProject, models.ReleaseProjectEnvironment, models.ProjectDebugFile,
                      models.ProjectSymCacheFile)
        relations.extend(
            [ModelRelation(m, {'project_id': instance.id}, ModelDeletionTask) for m in model_list]
        )

        return relations
