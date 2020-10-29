from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import EventUser


class ProjectUserDetailsEndpoint(ProjectEndpoint):
    def get(self, request, project, user_hash):
        euser = EventUser.objects.get(project_id=project.id, hash=user_hash)
        return Response(serialize(euser, request.user))
