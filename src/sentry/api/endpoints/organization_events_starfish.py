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

FEATURE = "organizations:starfish-test-endpoint"


@region_silo_endpoint
class OrganizationEventsStarfishEndpoint(OrganizationEventsV2EndpointBase):
    """
    This is a test endpoint that's meant to only be used for starfish testing
    purposes.
    """

    def get(self, request: Request, organization) -> Response:
        if not features.has(FEATURE, organization, actor=request.user):
            return Response(status=404)

        try:
            # db requests
            dashboard = Dashboard.objects.filter(organization_id=organization.id).last()
            serialize(dashboard, request.user)

            try:
                snuba_params, params = self.get_snuba_dataclass(request, organization)
            except NoProjects:
                return Response([])

            with sentry_sdk.start_span(op="starfish.endpoint", description="starfish_test_query"):
                referrer = Referrer.API_DISCOVER_QUERY_TABLE.value
                metrics_enhanced_performance.query(
                    selected_columns=["title", "count()"],
                    query="event.type:transaction",
                    params=params,
                    snuba_params=snuba_params,
                    limit=10000,
                    referrer=referrer,
                )

                # metrics_enhanced_performance.query(
                #     selected_columns=["title", "count_if(mechanism,equals,ANR)"],
                #     query="event.type:transaction",
                #     params=params,
                #     snuba_params=snuba_params,
                #     limit=10000,
                #     referrer=referrer,
                # )
        except Exception:
            return Response(status=200)

        return Response(status=200)
