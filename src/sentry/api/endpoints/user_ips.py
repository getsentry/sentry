from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models import UserIP


@control_silo_endpoint
class UserIPsEndpoint(UserEndpoint):
    @sudo_required
    def get(self, request: Request, user) -> Response:
        """
        Get list of IP addresses
        ````````````````````````

        Returns a list of IP addresses used to authenticate against this account.

        :auth required:
        """

        queryset = UserIP.objects.filter(user=user)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-last_seen",
            paginator_cls=DateTimePaginator,
            on_results=lambda x: serialize(x, request),
        )
