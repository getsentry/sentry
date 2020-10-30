from __future__ import absolute_import

from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models import UserIP


class UserIPsEndpoint(UserEndpoint):
    @sudo_required
    def get(self, request, user):
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
