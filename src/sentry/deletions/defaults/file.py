from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.files.file import File


class FileDeletionTask(ModelDeletionTask[File]):
    def get_query_filter(self) -> Q:
        """
        Returns a Q object that filters for the following orphaned Files:
        - Release-type Files, that are:
            1. Of release-related types (release.file, release.artifact-index)
            2. Have no corresponding ReleaseFile entry
            3. Are older than 90 days
        - Other obsolete file types such as:
            - `project.cficache` and `project.symcache` which were pre-Symbolicator
              cache files used in symbolication within the monolith.
        """
        from django.db.models import Exists, OuterRef

        from sentry.models.releasefile import ReleaseFile

        cutoff = timezone.now() - timedelta(days=90)

        # Subquery for checking if ReleaseFile references this File
        releasefile_exists = Exists(ReleaseFile.objects.filter(file_id=OuterRef("id")))

        releasefiles = Q(
            Q(
                type__in=["release.file", "release.artifact-index"],
                timestamp__lt=cutoff,
            )
            & ~releasefile_exists
        )
        cachefiles = Q(type__in=["project.cficache", "project.symcache"])

        return Q(releasefiles | cachefiles)

    def get_child_relations(self, instance: File) -> list[BaseRelation]:
        from sentry.models.files.fileblobindex import FileBlobIndex

        return [
            ModelRelation(FileBlobIndex, {"file_id": instance.id}),
        ]
