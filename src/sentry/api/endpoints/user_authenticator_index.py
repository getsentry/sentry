from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.models.authenticator import Authenticator


@control_silo_endpoint
class UserAuthenticatorIndexEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ENTERPRISE

    def get(self, request: Request, user) -> Response:
        """Returns all interface for a user (un-enrolled ones), otherwise an empty array"""

        interfaces = Authenticator.objects.all_interfaces_for_user(user, return_missing=True)
        return Response(serialize(list(interfaces)))
