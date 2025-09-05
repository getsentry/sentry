from datetime import datetime, timedelta, timezone

from django.db.models import Q

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.deploy import Deploy
from sentry.models.distribution import Distribution
from sentry.models.group import Group
from sentry.models.grouprelease import GroupRelease
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release
from sentry.models.releaseactivity import ReleaseActivity
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releasefile import ReleaseFile
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject


class ReleaseCleanupDeletionTask(ModelDeletionTask[Release]):
    """
    Deletion task for Release cleanup operations.

    This is more conservative than ReleaseDeletionTask and only deletes
    specific child relations that are safe to remove during cleanup.
    """

    def get_query_filter(self) -> Q:
        """
        Returns a Q object that filters for unused releases.
        Uses a 90-day cutoff for cleanup operations.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        return Release.get_unused_filter(cutoff)

    def get_child_relations(self, instance: Release) -> list[BaseRelation]:
        """
        Define child relations that will be deleted during cleanup.

        Now includes Deploy, Distribution, GroupRelease, and GroupResolution
        since the get_unused_filter() ensures these are old enough to be safely deleted.
        """
        return [
            ModelRelation(Deploy, {"release_id": instance.id}),
            ModelRelation(Distribution, {"release_id": instance.id}),
            ModelRelation(ReleaseActivity, {"release_id": instance.id}),
            ModelRelation(ReleaseCommit, {"release_id": instance.id}),
            ModelRelation(ReleaseHeadCommit, {"release_id": instance.id}),
            ModelRelation(ReleaseEnvironment, {"release_id": instance.id}),
            ModelRelation(ReleaseProjectEnvironment, {"release_id": instance.id}),
            ModelRelation(ReleaseProject, {"release_id": instance.id}),
            ModelRelation(ReleaseFile, {"release_id": instance.id}),
            ModelRelation(GroupRelease, {"release_id": instance.id}),
            ModelRelation(GroupResolution, {"release_id": instance.id}),
            ModelRelation(Group, {"first_release_id": instance.id}),
        ]
