from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import EventUser


class ProjectUserDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS

    def get(self, request, project, user_id):
        euser = EventUser.objects.get(
            project=project,
            hash=user_id,
        )
        return Response(serialize(euser, request.user))
