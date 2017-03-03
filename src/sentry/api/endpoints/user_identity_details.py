from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.models import AuthIdentity


class UserIdentityDetailsEndpoint(UserEndpoint):
    def delete(self, request, user, identity_id):
        AuthIdentity.objects.filter(
            user=user,
            id=identity_id,
        ).delete()
        return Response(status=204)
