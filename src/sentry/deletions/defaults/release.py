from ..base import ModelDeletionTask, ModelRelation


class ReleaseDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.deploy import Deploy
        from sentry.models.distribution import Distribution
        from sentry.models.group import Group
        from sentry.models.grouprelease import GroupRelease
        from sentry.models.groupresolution import GroupResolution
        from sentry.models.release import ReleaseProject
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseenvironment import ReleaseEnvironment
        from sentry.models.releasefile import ReleaseFile
        from sentry.models.releaseheadcommit import ReleaseHeadCommit
        from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment

        return [
            ModelRelation(Deploy, {"release_id": instance.id}),
            ModelRelation(Distribution, {"release_id": instance.id}),
            ModelRelation(ReleaseCommit, {"release_id": instance.id}),
            ModelRelation(ReleaseHeadCommit, {"release_id": instance.id}),
            ModelRelation(ReleaseEnvironment, {"release_id": instance.id}),
            ModelRelation(ReleaseProjectEnvironment, {"release_id": instance.id}),
            ModelRelation(ReleaseProject, {"release_id": instance.id}),
            ModelRelation(ReleaseFile, {"release_id": instance.id}),
            ModelRelation(GroupRelease, {"release_id": instance.id}),
            ModelRelation(GroupResolution, {"release_id": instance.id}),
            # In the API we guard release deletion if a release is
            # used as a first_release. However, when we delete organizations
            # we are going to delete the groups too.
            ModelRelation(Group, {"first_release_id": instance.id}),
        ]
