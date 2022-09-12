from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.models import AuthIdentity


@control_silo_endpoint
class UserIdentityDetailsEndpoint(UserEndpoint):
    def delete(self, request: Request, user, identity_id) -> Response:
        AuthIdentity.objects.filter(user=user, id=identity_id).delete()
        return Response(status=204)
