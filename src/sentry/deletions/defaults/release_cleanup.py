from datetime import datetime, timedelta, timezone

from django.db.models import Q

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.release import Release
from sentry.models.releaseactivity import ReleaseActivity
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
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
        Define child relations that are safe to delete during cleanup.

        This is more conservative than ReleaseDeletionTask - we don't delete
        Group references, GroupResolution, Distribution, Deploy, etc.
        """
        return [
            ModelRelation(ReleaseEnvironment, {"release_id": instance.id}),
            ModelRelation(ReleaseProjectEnvironment, {"release_id": instance.id}),
            ModelRelation(ReleaseActivity, {"release_id": instance.id}),
            ModelRelation(ReleaseCommit, {"release_id": instance.id}),
            ModelRelation(ReleaseHeadCommit, {"release_id": instance.id}),
            ModelRelation(ReleaseProject, {"release_id": instance.id}),
        ]

    def should_proceed(self, instance: Release) -> bool:
        """
        Additional safety check including recent activity verification.

        This method is called before deletion to ensure the release
        is truly safe to delete, including checking for recent activity.
        """
        # Use the cutoff from get_query_filter
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)

        # Check if any ReleaseProjectEnvironment has recent last_seen activity
        from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment

        if ReleaseProjectEnvironment.objects.filter(
            release=instance, last_seen__gte=cutoff
        ).exists():
            return False

        # Then check other dependencies using the instance method
        return instance.is_unused(cutoff)
