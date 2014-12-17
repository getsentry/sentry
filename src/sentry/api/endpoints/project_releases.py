from __future__ import absolute_import

from sentry.api.base import DocSection, Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Project, Release


class ProjectReleasesEndpoint(Endpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, project_id):
        """
        List a project's releases

        Retrieve a list of releases for a given project.

            {method} {path}

        """
        project = Project.objects.get(
            id=project_id,
        )

        assert_perm(project, request.user, request.auth)

        queryset = Release.objects.filter(
            project=project,
        ).order_by('-date_added')

        return self.paginate(
            request=request,
            queryset=queryset,
            # TODO(dcramer): we want to sort by date_added
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )
