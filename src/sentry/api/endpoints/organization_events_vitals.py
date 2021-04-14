import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.event_search import get_function_alias
from sentry.snuba import discover


class OrganizationEventsVitalsEndpoint(OrganizationEventsV2EndpointBase):
    VITALS = {
        "measurements.lcp": {"thresholds": [0, 2500, 4000]},
        "measurements.fid": {"thresholds": [0, 100, 300]},
        "measurements.cls": {"thresholds": [0, 0.1, 0.25]},
        "measurements.fcp": {"thresholds": [0, 1000, 3000]},
        "measurements.fp": {"thresholds": [0, 1000, 3000]},
    }
    # Threshold labels
    LABELS = ["good", "meh", "poor"]

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        with sentry_sdk.start_span(op="discover.endpoint", description="parse params"):
            try:
                params = self.get_snuba_params(request, organization)
            except NoProjects:
                return Response([])

            vitals = [vital.lower() for vital in request.GET.getlist("vital", [])]
            if len(vitals) == 0:
                raise ParseError(detail="Need to pass at least one vital")

            selected_columns = []
            aliases = {}
            for vital in vitals:
                if vital not in self.VITALS:
                    raise ParseError(detail=f"{vital} is not a valid vital")
                aliases[vital] = []
                for index, threshold in enumerate(self.VITALS[vital]["thresholds"]):
                    column = f"count_at_least({vital}, {threshold})"
                    # Order aliases for later calculation
                    aliases[vital].append(get_function_alias(column))
                    selected_columns.append(column)
                selected_columns.append(f"p75({vital})")

        with self.handle_query_errors():
            events_results = discover.query(
                selected_columns=selected_columns,
                query=request.GET.get("query"),
                params=params,
                # Results should only ever have 1 result
                limit=1,
                referrer="api.events.vitals",
                auto_fields=True,
                auto_aggregations=True,
                use_aggregate_conditions=True,
            )

        results = {}
        if len(events_results["data"]) == 1:
            event_data = events_results["data"][0]
            for vital in vitals:
                groups = len(aliases[vital])
                results[vital] = {}
                total = 0

                # Go backwards so that we can subtract and get the running total
                for i in range(groups - 1, -1, -1):
                    count = event_data[aliases[vital][i]]
                    group_count = 0 if count is None else count - total
                    results[vital][self.LABELS[i]] = group_count
                    total += group_count

                results[vital]["total"] = total
                results[vital]["p75"] = event_data.get(get_function_alias(f"p75({vital})"))

        return Response(results)
