from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models import OrganizationMemberWithProjectsSerializer
from sentry.models import OrganizationMember


class OrganizationUsersEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        projects = self.get_projects(request, organization)
        qs = (
            OrganizationMember.objects.filter(
                user__is_active=True,
                organization=organization,
                teams__projectteam__project__in=projects,
            )
            .select_related("user")
            .prefetch_related("teams", "teams__projectteam_set", "teams__projectteam_set__project")
            .order_by("user__email")
            .distinct()
        )

        return Response(
            serialize(
                list(qs),
                request.user,
                serializer=OrganizationMemberWithProjectsSerializer(
                    project_ids=[p.id for p in projects]
                ),
            )
        )
