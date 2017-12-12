from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import ProjectPlatform
from sentry.api.serializers import serialize


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = ProjectPlatform.objects.filter(project_id=project.id)
        return Response(serialize(list(queryset), request.user))
