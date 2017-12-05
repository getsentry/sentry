from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize, register, Serializer
from sentry.models import ProjectPlatform


@register(ProjectPlatform)
class ProjectPlatformSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {'platform': obj.platform, 'dateCreated': obj.date_added}

ERR_FIELD_REQUIRED = 'This field is required.'


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = ProjectPlatform.objects.filter(project_id=project.id)
        return Response(serialize(list(queryset), request.user))

    def put(self, request, project):
        platform_name = request.DATA.get('platform')

        if platform_name is None:
            return Response({
                'errors': {'platform': ERR_FIELD_REQUIRED},
            }, status=400
            )

        platform = ProjectPlatform.objects.create(project_id=project.id, platform=platform_name)
        return Response(serialize(platform, request.user))
