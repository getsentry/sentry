from __future__ import absolute_import

from django.db.models import Q
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import User


class ProjectMemberIndexEndpoint(ProjectEndpoint):
    def get(self, request, project):
        member_list = sorted(set(User.objects.filter(
            sentry_orgmember_set__organization=project.organization,
            is_active=True,
        ).filter(
            Q(sentry_orgmember_set__teams=project.team) |
            Q(sentry_orgmember_set__has_global_access=True)
        ).distinct()[:1000]), key=lambda x: x.email)

        member_list = serialize(member_list, request.user)

        return Response(member_list)
