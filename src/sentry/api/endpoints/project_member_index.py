from django.db.models import Q
from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Project, User
from rest_framework.response import Response


class ProjectMemberIndexEndpoint(Endpoint):
    def get(self, request, project_id):
        project = Project.objects.get_from_cache(id=project_id)

        assert_perm(project, request.user, request.auth)

        member_list = sorted(set(User.objects.filter(
            Q(member_set__team=project.team) |
            Q(accessgroup__projects=project),
        )[:1000]), key=lambda x: x.email)

        member_list = serialize(member_list, request.user)

        return Response(member_list)
