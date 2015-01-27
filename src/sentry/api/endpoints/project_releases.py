from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Project, Release


class ProjectReleasesEndpoint(Endpoint):
    def get(self, request, project_id):
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
            order_by='-date_added',
            on_results=lambda x: serialize(x, request.user),
        )
