from __future__ import absolute_import

from rest_framework import serializers
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
    """
    Tracks usage of a platform for a given project.

    Note: This endpoint is used solely for analytics.
    """

    def get(self, request, project):
        queryset = ProjectPlatform.objects.filter(project_id=project.id)
        return Response(serialize(list(queryset), request.user))
