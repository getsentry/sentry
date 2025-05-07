from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.users.models.user import User


@control_silo_endpoint
class AuthMergeUserAccountsEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SentryIsAuthenticated,)
    """
    List and merge user accounts with the same primary email address.
    """

    def get(self, request: Request) -> Response:
        if isinstance(request.user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )

        shared_email = request.user.email
        all_users = User.objects.filter(email=shared_email).order_by("last_active").values()
        return Response(serialize(all_users))
