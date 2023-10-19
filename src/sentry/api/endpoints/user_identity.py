from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.identity import Identity


@control_silo_endpoint
class UserIdentityEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, user) -> Response:
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
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
