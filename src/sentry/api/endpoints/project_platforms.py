from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize, register, Serializer
from sentry.models import ProjectPlatform


@register(ProjectPlatform)
class ProjectPlatformSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {'platform': obj.platform, 'dateCreated': obj.date_added}


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = ProjectPlatform.objects.filter(project_id=project.id)
        return Response(serialize(list(queryset), request.user))
