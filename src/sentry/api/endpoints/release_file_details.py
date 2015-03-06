from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile


class ReleaseFileDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, project, version, file_id):
        """
        Retrieve a file

        Return details on an individual file within a release.

            {method} {path}

        """
        release = Release.objects.get(
            project=project,
            version=version,
        )
        releasefile = ReleaseFile.objects.get(
            release=release,
            id=file_id,
        )

        return Response(serialize(releasefile, request.user))
