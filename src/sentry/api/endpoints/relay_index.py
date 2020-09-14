from __future__ import absolute_import

from django.conf import settings

from sentry.models import Relay
from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SuperuserPermission


class RelayIndexEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        """
        List your Relays
        ````````````````

        Return a list of relays know to this Sentry installation available
        to the authenticated session.

        :auth: required
        """
        queryset = Relay.objects.filter(public_key__in=settings.SENTRY_RELAY_WHITELIST_PK)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="relay_id",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
