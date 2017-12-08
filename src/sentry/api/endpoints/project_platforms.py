from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import ProjectPlatform
from rest_framework import status
from sentry.api.serializers import serialize


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request, project):

        project_platforms = ProjectPlatform.objects.filter(project_id=project.id)

        if len(project_platforms) < 1:
            return Response({}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serialize(list(project_platforms), request.user), status=status.HTTP_200_OK)
