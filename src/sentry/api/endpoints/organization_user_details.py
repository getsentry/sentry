from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import User
from sentry.api.endpoints.organization_member_index import MemberPermission


class OrganizationUserDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (MemberPermission,)

    def get(self, request, organization, user_id):
        try:
            user = User.objects.get(
                id=user_id, sentry_orgmember_set__organization_id=organization.id
            )
        except User.DoesNotExist:
            return Response(status=404)

        return Response(serialize(user, request.user))
