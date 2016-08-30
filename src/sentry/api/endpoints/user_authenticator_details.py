from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models import Authenticator


class UserAuthenticatorDetailsEndpoint(UserEndpoint):
    # XXX(dcramer): this requires superuser until we sort out how it will be
    # used from the React app (which will require some kind of double
    # verification)
    permission_classes = (SuperuserPermission,)

    def delete(self, request, user, auth_id):
        Authenticator.objects.filter(
            user=user,
            id=auth_id,
        ).delete()
        return Response(status=204)
