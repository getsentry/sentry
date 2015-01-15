from __future__ import absolute_import

from django.db.models import Q
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Project, User


class ProjectMemberIndexEndpoint(Endpoint):
    def get(self, request, project_id):
        project = Project.objects.get_from_cache(id=project_id)

        assert_perm(project, request.user, request.auth)

        member_list = sorted(set(User.objects.filter(
            sentry_orgmember_set__organization=project.organization,
        ).filter(
            Q(sentry_orgmember_set__teams=project.team) |
            Q(sentry_orgmember_set__has_global_access=True)
        ).distinct()[:1000]), key=lambda x: x.email)

        member_list = serialize(member_list, request.user)

        return Response(member_list)
