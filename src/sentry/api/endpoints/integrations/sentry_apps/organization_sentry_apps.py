from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, add_integration_platform_metric_tag
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import SentryAppStatus
from sentry.models import SentryApp


@region_silo_endpoint
class OrganizationSentryAppsEndpoint(OrganizationEndpoint):
    @add_integration_platform_metric_tag
    def get(self, request: Request, organization) -> Response:
        queryset = SentryApp.objects.filter(owner_id=organization.id, application__isnull=False)

        if SentryAppStatus.as_int(request.GET.get("status")) is not None:
            queryset = queryset.filter(status=SentryAppStatus.as_int(request.GET.get("status")))

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, access=request.access),
        )
