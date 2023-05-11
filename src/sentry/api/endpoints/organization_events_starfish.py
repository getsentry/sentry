from datetime import timedelta

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.api.serializers import serialize
from sentry.models.dashboard import Dashboard
from sentry.snuba import metrics_enhanced_performance
from sentry.snuba.referrer import Referrer

TAG_ALIASES = {"release": "sentry:release", "dist": "sentry:dist", "user": "sentry:user"}
SIX_HOURS = int(timedelta(hours=6).total_seconds())
READ_FEATURE = "organizations:dashboards-basic"


@region_silo_endpoint
class OrganizationEventsStarfishEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request: Request, organization) -> Response:
        if not features.has(READ_FEATURE, organization, actor=request.user):
            return Response(status=404)

        # db request
        dashboard = Dashboard.objects.filter(organization_id=organization.id).last()
        serialized_dashboard = serialize(dashboard, request.user)

        try:
            params = self._setup(request, organization)
        except NoProjects:
            return Response([])

        snuba_params, params = self.get_snuba_dataclass(request, organization)

        with sentry_sdk.start_span(op="starfish.endpoint", description="starfish_test_query"):
            referrer = Referrer.API_DISCOVER_QUERY_TABLE.value
            results = metrics_enhanced_performance.query(
                selected_columns=["title", "count()"],
                query="event.type:transaction",
                params=params,
                snuba_params=snuba_params,
                limit=10000,
                referrer=referrer,
            )

        if not results:
            return {"dashboard_name": serialized_dashboard["title"]}

        return Response(
            {"dashboard_name": serialized_dashboard["title"], "data": results[0]},
            status=200,
        )
