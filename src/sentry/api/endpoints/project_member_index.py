from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import OrganizationMember


@region_silo_endpoint
class ProjectMemberIndexEndpoint(ProjectEndpoint):
    def get(self, request: Request, project) -> Response:
        queryset = OrganizationMember.objects.filter(
            Q(user_is_active=True, user_id__isnull=False) | Q(user_id__isnull=True),
            organization=project.organization,
            teams__in=project.teams.all(),
        ).distinct()

        member_list = sorted(queryset, key=lambda x: x.email or x.id)

        context = serialize(member_list, request.user)

        return Response(context)
