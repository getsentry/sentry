from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import ProjectPlatform
from rest_framework import serializers, status
from sentry.api.serializers import serialize
from django.core.exceptions import ObjectDoesNotExist


class ProjectPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectPlatform
        fields = ('platform',)


class ProjectPlatformsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        try:
            project_platform = ProjectPlatform.objects.get(project_id=project.id)

        except ObjectDoesNotExist:
            return Response({}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serialize(project_platform, request.user), status=status.HTTP_200_OK)
