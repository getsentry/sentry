from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import OrganizationMember


class OrganizationUserDetailsEndpoint(OrganizationEndpoint):
    def get(self, request, organization, user_id):
        try:
            org_member = OrganizationMember.objects.get(
                user__id=user_id,
                organization=organization,
            )
        except OrganizationMember.DoesNotExist:
            return Response(status=404)

        return Response(serialize(org_member, request.user))
