from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.models.authidentity import AuthIdentity
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.models.user import User


@control_silo_endpoint
class UserIdentityDetailsEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def delete(self, request: Request, user: User, identity_id: int) -> Response:
        try:
            ai = AuthIdentity.objects.get(user=user, id=identity_id)
            ai.delete()
        except AuthIdentity.DoesNotExist:
            pass
        return Response(status=204)
