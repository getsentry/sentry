from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.tagvalue import EnvironmentTagValueSerializer
from sentry.models import TagValue


class ProjectEnvironmentsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = TagValue.objects.filter(
            project=project.id,
            key='environment',
        ).order_by('value')

        return Response(serialize(
            list(queryset), request.user, EnvironmentTagValueSerializer()))
