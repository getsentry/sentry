from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.users.api.serializers.user import UserSerializerWithOrgMemberships
from sentry.users.models.user import User


@control_silo_endpoint
class AuthMergeUserAccountsEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (SentryIsAuthenticated,)
    """
    List and merge user accounts with the same primary email address.
    """

    def get(self, request: Request) -> Response:
        user = request.user
        if isinstance(user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )

        shared_email = user.email
        if not shared_email:
            return Response(
                status=400,
                data={"error": "Shared email is empty or null"},
            )
        queryset = User.objects.filter(email=shared_email).order_by("last_active")
        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, user, UserSerializerWithOrgMemberships()),
            paginator_cls=OffsetPaginator,
        )
