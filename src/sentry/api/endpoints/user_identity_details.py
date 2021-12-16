from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.models import AuthIdentity, User


class UserIdentityDetailsEndpoint(UserEndpoint):
    def delete(self, request: Request, user: User, identity_id: int) -> Response:
        AuthIdentity.objects.filter(user=user, id=identity_id).delete()
        return Response(status=204)
