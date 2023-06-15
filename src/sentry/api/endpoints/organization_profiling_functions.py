from __future__ import annotations

from datetime import timedelta
from enum import Enum
from typing import Any

from django.conf import settings
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3 import Retry

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.net.http import connection_from_url
from sentry.snuba import functions
from sentry.snuba.referrer import Referrer
from sentry.utils import json
from sentry.utils.dates import parse_stats_period, validate_interval
from sentry.utils.sdk import set_measurement

ads_connection_pool = connection_from_url(
    settings.ANOMALY_DETECTION_URL,
    retries=Retry(
        total=5,
        status_forcelist=[408, 429, 502, 503, 504],
    ),
    timeout=settings.ANOMALY_DETECTION_TIMEOUT,
)

TOP_FUNCTIONS_LIMIT = 50
FUNCTIONS_PER_QUERY = 10


class TrendType(Enum):
    REGRESSION = "regression"
    IMPROVEMENT = "improvement"

    def as_sort(self):
        if self is TrendType.REGRESSION:
            return "-trend_percentage()"

        if self is TrendType.IMPROVEMENT:
            return "trend_percentage()"

        raise ValueError(f"Unknown TrendType: {self.value}")


class TrendTypeField(serializers.Field):
    def to_representation(self, trend_type: TrendType):
        return trend_type.value

    def to_internal_value(self, data: Any) -> TrendType | None:
        for trend_type in TrendType:
            if data == trend_type.value:
                return trend_type

        expected = " or ".join(trend_type.value for trend_type in TrendType)
        raise serializers.ValidationError(f"Unknown trend type. Expected {expected}")


class FunctionTrendsSerializer(serializers.Serializer):
    function = serializers.CharField(max_length=10)
    trend = TrendTypeField()
    query = serializers.CharField(required=False)


@region_silo_endpoint
class OrganizationProfilingFunctionTrendsEndpoint(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:profiling-global-suspect-functions", organization, actor=request.user
        )

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        serializer = FunctionTrendsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        top_functions = {}

        def get_event_stats(columns, query, params, _rollup, zerofill_results, comparison_delta):
            nonlocal top_functions

            rollup = get_rollup_from_range(params["end"] - params["start"])

            top_functions = functions.query(
                selected_columns=[
                    "project.id",
                    "fingerprint",
                    "package",
                    "function",
                    "count()",
                ],
                query=query,
                params=params,
                orderby=["-count()"],
                limit=TOP_FUNCTIONS_LIMIT,
                referrer=Referrer.API_PROFILING_FUNCTION_TRENDS_TOP_EVENTS.value,  # type: ignore[attr-defined]
                use_aggregate_conditions=True,
                transform_alias_to_input_format=True,
            )

            set_measurement("profiling.top_functions", len(top_functions.get("data", [])))

            results = functions.top_events_timeseries(
                timeseries_columns=columns,
                selected_columns=["project.id", "fingerprint"],
                query=query,
                params=params,
                orderby=None,
                rollup=rollup,
                limit=TOP_FUNCTIONS_LIMIT,
                top_events=top_functions,
                organization=organization,
                zerofill_results=zerofill_results,
                referrer=Referrer.API_PROFILING_FUNCTION_TRENDS_STATS.value,  # type: ignore[attr-defined]
                # this ensures the result key is formatted as `{project.id},{fingerprint}`
                # in order to be compatible with the trends service
                result_key_order=["project.id", "fingerprint"],
            )

            return results

        def get_trends_data(stats_data):
            trends_request = {
                "data": stats_data,
                "sort": data["trend"].as_sort(),
                "trendFunction": data["function"],
            }

            return trends_query(trends_request)

        stats_data = self.get_event_stats_data(
            request,
            organization,
            get_event_stats,
            top_events=FUNCTIONS_PER_QUERY,
            query_column=data["function"],
            params=params,
            query=data.get("query"),
        )

        trending_functions = get_trends_data(stats_data)

        def paginate_trending_events(offset, limit):
            return {"data": trending_functions[offset : limit + offset]}

        def get_stats_data_for_trending_events(results):
            functions = {
                f"{function['project.id']},{function['fingerprint']}": function
                for function in top_functions.get("data", [])
            }
            formatted_results = []
            for result in results["data"]:
                # The endpoint originally was meant for only transactions
                # hence the name of the key, but it can be adapted to work
                # for functions as well.
                key = f"{result['project']},{result['transaction']}"
                formatted_result = {"stats": stats_data[key]}
                formatted_result.update(
                    {
                        k: result[k]
                        for k in [
                            "aggregate_range_1",
                            "aggregate_range_2",
                            "breakpoint",
                            "change",
                            "project",
                            "trend_difference",
                            "trend_percentage",
                            "unweighted_p_value",
                            "unweighted_t_value",
                        ]
                    }
                )
                formatted_result.update(
                    {
                        k: functions[key][k]
                        for k in ["fingerprint", "package", "function", "count()"]
                    }
                )
                formatted_results.append(formatted_result)
            return formatted_results

        with self.handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=paginate_trending_events),
                on_results=get_stats_data_for_trending_events,
                default_per_page=5,
                max_per_page=5,
            )


def get_rollup_from_range(date_range: timedelta, top_functions=TOP_FUNCTIONS_LIMIT) -> int:
    interval = parse_stats_period(get_interval_from_range(date_range))
    if interval is None:
        interval = timedelta(hours=1)
    validate_interval(interval, InvalidSearchQuery(), date_range, top_functions)
    return int(interval.total_seconds())


def get_interval_from_range(date_range: timedelta) -> str:
    """
    This is a specialized variant of the generic `get_interval_from_range`
    function tailored for the function trends use case.

    We have a limit of 10,000 from snuba, and if we limit ourselves to 50
    unique functions, this gives us room for 200 data points per function.
    The default `get_interval_from_range` is fairly close to this already
    so this implementation provides this additional guarantee.
    """
    if date_range > timedelta(days=60):
        return "12h"

    if date_range > timedelta(days=30):
        return "8h"

    if date_range > timedelta(days=14):
        return "4h"

    if date_range > timedelta(days=7):
        return "2h"

    return "1h"


def trends_query(trends_request):
    response = ads_connection_pool.urlopen(
        "POST",
        "/trends/breakpoint-detector",
        body=json.dumps(trends_request),
        headers={"content-type": "application/json;charset=utf-8"},
    )

    return json.loads(response.data)["data"]
