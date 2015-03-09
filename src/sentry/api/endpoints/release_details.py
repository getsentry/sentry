from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile


class ReleaseDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, project, version):
        """
        Retrieve a release

        Return details on an individual release.

            {method} {path}

        """
        release = Release.objects.get(
            project=project,
            version=version,
        )

        return Response(serialize(release, request.user))

    def delete(self, request, project, version):
        """
        Delete a release

        Permanently remove a release and all of its files.

            {method} {path}

        """
        # TODO(dcramer): this needs to happen in the queue as it could be a long
        # and expensive operation
        release = Release.objects.get(
            project=project,
            version=version,
        )

        file_list = ReleaseFile.objects.filter(
            release=release,
        ).select_related('file')
        for releasefile in file_list:
            releasefile.file.delete()
            releasefile.delete()
        release.delete()

        return Response(status=204)
