from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Release, ReleaseFile
from sentry.models.releasefile import ReleaseArchive


class ProjectReleaseFilesMetaEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project, version):
        """
        List meta information about the files stored with a release
        ``````````````````````````````

        Retrieve a list of files for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        meta = {
            "individualCount": release.count_release_files(),
            "archivedCount": 0,
        }

        release_file = release.get_archive_release_file()
        if release_file is not None:
            meta["archiveId"] = release_file.id
            file_ = ReleaseFile.cache.getfile(release_file)
            archive = ReleaseArchive(file_.file)
            with archive:
                meta["archivedCount"] = len(archive.manifest.get("files", {}))

        return Response(meta)
