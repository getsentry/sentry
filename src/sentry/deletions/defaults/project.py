from __future__ import annotations

from ..base import BulkModelDeletionTask, ModelDeletionTask, ModelRelation


class ProjectDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.discover.models import DiscoverSavedQueryProject
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.incidents.models.incident import IncidentProject
        from sentry.models.activity import Activity
        from sentry.models.appconnectbuilds import AppConnectBuild
        from sentry.models.artifactbundle import ProjectArtifactBundle
        from sentry.models.debugfile import ProguardArtifactRelease, ProjectDebugFile
        from sentry.models.environment import EnvironmentProject
        from sentry.models.eventattachment import EventAttachment
        from sentry.models.group import Group
        from sentry.models.groupassignee import GroupAssignee
        from sentry.models.groupbookmark import GroupBookmark
        from sentry.models.groupemailthread import GroupEmailThread
        from sentry.models.grouphash import GroupHash
        from sentry.models.grouprelease import GroupRelease
        from sentry.models.grouprulestatus import GroupRuleStatus
        from sentry.models.groupseen import GroupSeen
        from sentry.models.groupshare import GroupShare
        from sentry.models.groupsubscription import GroupSubscription
        from sentry.models.integrations.repository_project_path_config import (
            RepositoryProjectPathConfig,
        )
        from sentry.models.latestappconnectbuildscheck import LatestAppConnectBuildsCheck
        from sentry.models.projectbookmark import ProjectBookmark
        from sentry.models.projectcodeowners import ProjectCodeOwners
        from sentry.models.projectkey import ProjectKey
        from sentry.models.projectteam import ProjectTeam
        from sentry.models.promptsactivity import PromptsActivity
        from sentry.models.release_threshold import ReleaseThreshold
        from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
        from sentry.models.releases.release_project import ReleaseProject
        from sentry.models.servicehook import ServiceHook, ServiceHookProject
        from sentry.models.transaction_threshold import ProjectTransactionThreshold
        from sentry.models.userreport import UserReport
        from sentry.monitors.models import Monitor
        from sentry.replays.models import ReplayRecordingSegment
        from sentry.snuba.models import QuerySubscription

        relations = [
            # ProjectKey gets revoked immediately, in bulk
            ModelRelation(ProjectKey, {"project_id": instance.id})
        ]

        # in bulk
        for m in (
            Activity,
            AppConnectBuild,
            EnvironmentProject,
            GroupAssignee,
            GroupBookmark,
            GroupEmailThread,
            GroupHash,
            GroupRelease,
            GroupRuleStatus,
            GroupSeen,
            GroupShare,
            GroupSubscription,
            LatestAppConnectBuildsCheck,
            ProjectBookmark,
            ProjectKey,
            ReleaseThreshold,
            ProjectTeam,
            PromptsActivity,
            # order matters, ProjectCodeOwners to be deleted before RepositoryProjectPathConfig
            ProjectCodeOwners,
            ReplayRecordingSegment,
            RepositoryProjectPathConfig,
            ServiceHookProject,
            ServiceHook,
            UserReport,
            ProjectTransactionThreshold,
            # NOTE: Removing the project relation from `ProjectArtifactBundle` may
            # leave behind orphaned `ArtifactBundle`s. Though thats not a big problem
            # as those are being automatically cleaned up on their own.
            ProjectArtifactBundle,
            ProguardArtifactRelease,
            DiscoverSavedQueryProject,
            IncidentProject,
            QuerySubscription,
        ):
            relations.append(ModelRelation(m, {"project_id": instance.id}, BulkModelDeletionTask))
        relations.append(ModelRelation(Monitor, {"project_id": instance.id}))
        relations.append(ModelRelation(Group, {"project_id": instance.id}))
        relations.append(
            ModelRelation(
                AlertRule,
                {"snuba_query__subscriptions__project": instance, "include_all_projects": False},
            )
        )

        # Release needs to handle deletes after Group is cleaned up as the foreign
        # key is protected
        for m in (
            ReleaseProject,
            ReleaseProjectEnvironment,
            EventAttachment,
            ProjectDebugFile,
        ):
            relations.append(ModelRelation(m, {"project_id": instance.id}, ModelDeletionTask))
        return relations
