from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.models.authidentity import AuthIdentity


@control_silo_endpoint
class UserIdentityDetailsEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
    }

    def delete(self, request: Request, user, identity_id) -> Response:
        try:
            ai = AuthIdentity.objects.get(user=user, id=identity_id)
            ai.delete()
        except AuthIdentity.DoesNotExist:
            pass
        return Response(status=204)
