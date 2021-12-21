from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectPlatform


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request: Request, project) -> Response:
        queryset = ProjectPlatform.objects.filter(project_id=project.id)
        return Response(serialize(list(queryset), request.user))
