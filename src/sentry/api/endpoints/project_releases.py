from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Release


class ProjectReleasesEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, project):
        """
        List a project's releases

        Retrieve a list of releases for a given project.

            {method} {path}

        """
        queryset = Release.objects.filter(
            project=project,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )
