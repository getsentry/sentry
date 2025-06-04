from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.models.relay import Relay


@region_silo_endpoint
class RelayIndexEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SuperuserPermission,)
    owner = ApiOwner.OWNERS_INGEST

    def get(self, request: Request) -> Response:
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
