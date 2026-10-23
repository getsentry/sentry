from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import traces

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.search.events.fields import get_function_alias
from sentry.snuba import discover

VITALS = {
    "measurements.lcp": {"thresholds": [0, 2500, 4000]},
    "measurements.fid": {"thresholds": [0, 100, 300]},
    "measurements.cls": {"thresholds": [0, 0.1, 0.25]},
    "measurements.fcp": {"thresholds": [0, 1000, 3000]},
    "measurements.fp": {"thresholds": [0, 1000, 3000]},
}


class EventsVitalResponse(TypedDict):
    p75: float | None
    total: int
    good: int
    meh: int
    poor: int


class EventsVitalsMetaResponse(TypedDict):
    isMetricsData: bool


EventsVitalsResponse = dict[str, EventsVitalResponse | EventsVitalsMetaResponse]


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationEventsVitalsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="getOrganizationEventsVitals",
        summary="Retrieve Web Vitals Summary",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            VisibilityParams.QUERY,
            OpenApiParameter(
                name="vital",
                location="query",
                required=True,
                type=str,
                many=True,
                enum=list(VITALS.keys()),
                description="The web vitals to summarize.",
            ),
            OpenApiParameter(
                name="preventMetricAggregates",
                location="query",
                required=False,
                type=str,
                enum=["0", "1"],
                description="Set to `1` to prevent the query from using metrics-backed aggregates.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsVitalsResponse", EventsVitalsResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Return the p75 and the number of `good`, `meh`, and `poor` events for each
        requested web vital, keyed by vital. The `meta` key reports whether the data
        came from metrics.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        with traces.start_span(name="parse params", attributes={"sentry.op": "discover.endpoint"}):
            try:
                snuba_params = self.get_snuba_params(request, organization)
            except NoProjects:
                return Response([])

            vitals = [vital.lower() for vital in request.GET.getlist("vital", [])]
            if len(vitals) == 0:
                raise ParseError(detail="Need to pass at least one vital")

            allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"

            selected_columns = []
            for vital in vitals:
                if vital not in VITALS:
                    raise ParseError(detail=f"{vital} is not a valid vital")
                selected_columns.extend(
                    [
                        f"p75({vital})",
                        f"count_web_vitals({vital}, good)",
                        f"count_web_vitals({vital}, meh)",
                        f"count_web_vitals({vital}, poor)",
                        f"count_web_vitals({vital}, any)",
                    ]
                )

        with handle_query_errors():
            events_results = discover.query(
                selected_columns=selected_columns,
                query=request.GET.get("query", ""),
                snuba_params=snuba_params,
                # Results should only ever have 1 result
                limit=1,
                referrer="api.events.vitals",
                auto_fields=True,
                auto_aggregations=False,
                use_aggregate_conditions=False,
                allow_metric_aggregates=allow_metric_aggregates,
                transform_alias_to_input_format=False,
            )

        results: EventsVitalsResponse = {}
        if len(events_results["data"]) == 1:
            event_data = events_results["data"][0]
            for vital in vitals:
                results[vital] = {
                    "p75": event_data.get(get_function_alias(f"p75({vital})")),
                    "total": event_data.get(get_function_alias(f"count_web_vitals({vital}, any)"))
                    or 0,
                    "good": event_data.get(get_function_alias(f"count_web_vitals({vital}, good)"))
                    or 0,
                    "meh": event_data.get(get_function_alias(f"count_web_vitals({vital}, meh)"))
                    or 0,
                    "poor": event_data.get(get_function_alias(f"count_web_vitals({vital}, poor)"))
                    or 0,
                }
        results["meta"] = {"isMetricsData": events_results["meta"].get("isMetricsData", False)}

        return Response(results)
