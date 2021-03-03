from sentry.api.bases import OrganizationEndpoint, add_integration_platform_metric_tag
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import SentryApp


class OrganizationSentryAppsEndpoint(OrganizationEndpoint):
    @add_integration_platform_metric_tag
    def get(self, request, organization):
        queryset = SentryApp.objects.filter(owner=organization, application__isnull=False)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, access=request.access),
        )
