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
            1. Of release-related types (release.file, release.bundle, release.artifact-index)
            2. Have no corresponding ReleaseFile entry
            3. Are older than 90 days
        - project.dif Files older than 90 days with no corresponding ProjectDebugFile entry
        - Other obsolete file types such as:
            - `project.cficache` and `project.symcache` which were pre-Symbolicator
              cache files used in symbolication within the monolith.
        """
        from django.db.models import Exists, OuterRef

        from sentry.models.debugfile import ProjectDebugFile
        from sentry.models.releasefile import ReleaseFile

        cutoff = timezone.now() - timedelta(days=90)

        # Subqueries for checking if this File is referenced
        releasefile_exists = Exists(ReleaseFile.objects.filter(file_id=OuterRef("id")))
        project_debug_file_exists = Exists(ProjectDebugFile.objects.filter(file_id=OuterRef("id")))

        releasefiles = Q(
            Q(
                type__in=["release.file", "release.bundle", "release.artifact-index"],
                timestamp__lt=cutoff,
            )
            & ~releasefile_exists
        )
        debugfiles = Q(type="project.dif", timestamp__lt=cutoff) & ~project_debug_file_exists
        cachefiles = Q(type__in=["project.cficache", "project.symcache"])

        return Q(releasefiles | debugfiles | cachefiles)

    def get_child_relations(self, instance: File) -> list[BaseRelation]:
        from sentry.models.files.fileblobindex import FileBlobIndex

        return [
            ModelRelation(FileBlobIndex, {"file_id": instance.id}),
        ]
