from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Environment


class ProjectEnvironmentsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = Environment.objects.filter(
            project_id=project.id,
        ).order_by('name')

        return Response(serialize(list(queryset), request.user))
