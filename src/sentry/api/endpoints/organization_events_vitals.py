import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.utils import handle_query_errors
from sentry.search.events.fields import get_function_alias
from sentry.snuba import discover


@region_silo_endpoint
class OrganizationEventsVitalsEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    VITALS = {
        "measurements.lcp": {"thresholds": [0, 2500, 4000]},
        "measurements.fid": {"thresholds": [0, 100, 300]},
        "measurements.cls": {"thresholds": [0, 0.1, 0.25]},
        "measurements.fcp": {"thresholds": [0, 1000, 3000]},
        "measurements.fp": {"thresholds": [0, 1000, 3000]},
    }

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        with sentry_sdk.start_span(op="discover.endpoint", name="parse params"):
            try:
                snuba_params = self.get_snuba_params(request, organization)
            except NoProjects:
                return Response([])

            vitals = [vital.lower() for vital in request.GET.getlist("vital", [])]
            if len(vitals) == 0:
                raise ParseError(detail="Need to pass at least one vital")

            performance_use_metrics = features.has(
                "organizations:performance-use-metrics",
                organization=organization,
                actor=request.user,
            )
            dataset = self.get_dataset(request) if performance_use_metrics else discover
            metrics_enhanced = dataset != discover
            sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)
            allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"

            selected_columns = []
            for vital in vitals:
                if vital not in self.VITALS:
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
            events_results = dataset.query(
                selected_columns=selected_columns,
                query=request.GET.get("query"),
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

        results = {}
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
