from ..base import BulkModelDeletionTask, ModelDeletionTask, ModelRelation


class ProjectDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry import models
        from sentry.discover.models import DiscoverSavedQueryProject
        from sentry.incidents.models import AlertRule, IncidentProject
        from sentry.monitors.models import Monitor
        from sentry.replays.models import ReplayRecordingSegment
        from sentry.snuba.models import QuerySubscription

        relations = [
            # ProjectKey gets revoked immediately, in bulk
            ModelRelation(models.ProjectKey, {"project_id": instance.id})
        ]

        # in bulk
        model_list = (
            models.Activity,
            models.AppConnectBuild,
            models.EnvironmentProject,
            models.EventAttachment,
            models.EventUser,
            models.GroupAssignee,
            models.GroupBookmark,
            models.GroupEmailThread,
            models.GroupHash,
            models.GroupRelease,
            models.GroupRuleStatus,
            models.GroupSeen,
            models.GroupShare,
            models.GroupSubscription,
            models.LatestAppConnectBuildsCheck,
            models.ProjectBookmark,
            models.ProjectKey,
            models.ProjectTeam,
            models.PromptsActivity,
            # order matters, ProjectCodeOwners to be deleted before RepositoryProjectPathConfig
            models.ProjectCodeOwners,
            ReplayRecordingSegment,
            models.RepositoryProjectPathConfig,
            models.ServiceHookProject,
            models.ServiceHook,
            models.UserReport,
            models.ProjectTransactionThreshold,
            DiscoverSavedQueryProject,
            IncidentProject,
            QuerySubscription,
        )
        relations.extend(
            [
                ModelRelation(m, {"project_id": instance.id}, BulkModelDeletionTask)
                for m in model_list
            ]
        )
        relations.append(ModelRelation(Monitor, {"project_id": instance.id}))
        relations.append(ModelRelation(models.Group, {"project_id": instance.id}))
        relations.append(
            ModelRelation(
                AlertRule,
                {"snuba_query__subscriptions__project": instance, "include_all_projects": False},
            )
        )

        # Release needs to handle deletes after Group is cleaned up as the foreign
        # key is protected
        model_list = (
            models.ReleaseProject,
            models.ReleaseProjectEnvironment,
            models.ProjectDebugFile,
        )
        relations.extend(
            [ModelRelation(m, {"project_id": instance.id}, ModelDeletionTask) for m in model_list]
        )
        return relations
