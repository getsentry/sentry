from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models import OrganizationMemberWithProjectsSerializer
from sentry.models import OrganizationMember


class OrganizationUsersEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        project_ids = self.get_project_ids(request, organization)
        qs = OrganizationMember.objects.filter(
            user__is_active=True,
            organization=organization,
            teams__projectteam__project_id__in=project_ids,
        ).select_related('user').prefetch_related(
            'teams',
            'teams__projectteam_set',
            'teams__projectteam_set__project',
        ).order_by('user__email').distinct()

        return Response(serialize(
            list(qs),
            request.user,
            serializer=OrganizationMemberWithProjectsSerializer(project_ids=project_ids),
        ))
