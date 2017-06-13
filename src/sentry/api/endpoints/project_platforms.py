from __future__ import absolute_import

from django.utils import timezone
from rest_framework.response import Response
from rest_framework import serializers
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectPlatform


class ProjectPlatformSerializer(serializers.Serializer):
    project_id = serializers.IntegerField()
    platform = serializers.CharField()


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = ProjectPlatform.objects.filter(
            project_id=project.id
        ).values('project_id', 'platform', 'date_added', 'last_seen', 'date_chosen')
        return Response(serialize(list(queryset), request.user))

    def post(self, request, project):
        now = timezone.now()
        serializer = ProjectPlatformSerializer(data=request.DATA, context={'project': project})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = dict(serializer.object)
        values = {
            'date_chosen': now,
            'date_added': None,
            'last_seen': None
        }
        project_platform = ProjectPlatform.objects.create_or_update(
            project_id=data['project_id'],
            platform=data['platform'],
            values=values
        )
        return Response(serialize(project_platform, request.user), status=201)
