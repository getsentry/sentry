from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework import serializers
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectPlatform


class ProjectPlatformSerializer(serializers.Serializer):
    platform = serializers.CharField()


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = ProjectPlatform.objects.filter(
            project_id=project.id
        ).values('project_id', 'platform', 'date_added', 'last_seen')
        return Response(serialize(list(queryset), request.user))
