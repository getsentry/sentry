from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.api.serializers.identity import IdentitySerializer
from sentry.users.models.identity import Identity
from sentry.users.models.user import User


@control_silo_endpoint
class UserIdentityEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, user: User) -> Response:
        """
        Retrieve all of a users' identities (NOT AuthIdentities)
        `````````````````````````````````

        :pparam string user ID: user ID, or 'me'
        :auth: required
        """
        queryset = Identity.objects.filter(user=user)

        provider = request.GET.get("provider")
        if provider:
            queryset = queryset.filter(idp__type=provider.lower())

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user, serializer=IdentitySerializer()),
            paginator_cls=OffsetPaginator,
        )
