from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import ProjectPlatform


ERR_FIELD_REQUIRED = 'This field is required.'


class ProjectPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectPlatform
        fields = ('platform',)


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = ProjectPlatform.objects.filter(project_id=project.id)
        return Response(serialize(list(queryset), request.user))

    def put(self, request, project):
        serializer = ProjectPlatformSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status.HTTP_400_BAD_REQUEST)

        platform = serializer.object
        platform.project_id = project.id
        platform.save()

        return Response(serialize(platform, request.user), status=status.HTTP_202_ACCEPTED)
