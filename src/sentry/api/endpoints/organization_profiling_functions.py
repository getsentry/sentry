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
from sentry.search.events.builder import ProfileTopFunctionsTimeseriesQueryBuilder
from sentry.snuba import functions
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils import json
from sentry.utils.dates import parse_stats_period, validate_interval
from sentry.utils.sdk import set_measurement
from sentry.utils.snuba import bulk_snql_query

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
    threshold = serializers.IntegerField(min_value=0, max_value=1000, default=16, required=False)


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

        top_functions = functions.query(
            selected_columns=[
                "project.id",
                "fingerprint",
                "package",
                "function",
                "count()",
                "examples()",
            ],
            query=data.get("query"),
            params=params,
            orderby=["-count()"],
            limit=TOP_FUNCTIONS_LIMIT,
            referrer=Referrer.API_PROFILING_FUNCTION_TRENDS_TOP_EVENTS.value,
            auto_aggregations=True,
            use_aggregate_conditions=True,
            transform_alias_to_input_format=True,
        )

        def get_event_stats(_columns, query, params, _rollup, zerofill_results, _comparison_delta):
            rollup = get_rollup_from_range(params["end"] - params["start"])

            chunks = [
                top_functions["data"][i : i + FUNCTIONS_PER_QUERY]
                for i in range(0, len(top_functions["data"]), FUNCTIONS_PER_QUERY)
            ]

            builders = [
                ProfileTopFunctionsTimeseriesQueryBuilder(
                    dataset=Dataset.Functions,
                    params=params,
                    interval=rollup,
                    top_events=chunk,
                    other=False,
                    query=query,
                    selected_columns=["project.id", "fingerprint"],
                    # It's possible to override the columns via
                    # the `yAxis` qs. So we explicitly ignore the
                    # columns, and hard code in the columns we want.
                    timeseries_columns=[data["function"], "worst()"],
                    skip_tag_resolution=True,
                )
                for chunk in chunks
            ]
            bulk_results = bulk_snql_query(
                [builder.get_snql_query() for builder in builders],
                Referrer.API_PROFILING_FUNCTION_TRENDS_STATS.value,
            )

            results = {}

            for chunk, builder, result in zip(chunks, builders, bulk_results):
                formatted_results = functions.format_top_events_timeseries_results(
                    result,
                    builder,
                    params,
                    rollup,
                    top_events={"data": chunk},
                    result_key_order=["project.id", "fingerprint"],
                )

                results.update(formatted_results)

            return results

        def get_trends_data(stats_data):
            if not stats_data:
                return []

            trends_request = {
                "data": {
                    k: {
                        "data": v[data["function"]]["data"],
                        "data_start": v[data["function"]]["start"],
                        "data_end": v[data["function"]]["end"],
                        # We want to use the first 20% of the data as historical data
                        # to help filter out false positives.
                        # This means if there is a change in the first 20%, it will
                        # not be detected as a breakpoint.
                        "request_start": v[data["function"]]["data"][
                            len(v[data["function"]]["data"]) // 5
                        ][0],
                        "request_end": v[data["function"]]["end"],
                    }
                    for k, v in stats_data.items()
                    if v[data["function"]]["data"]
                },
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
            additional_query_column="worst()",
            params=params,
            query=data.get("query"),
        )

        trending_functions = get_trends_data(stats_data)

        all_trending_functions_count = len(trending_functions)
        set_measurement("profiling.top_functions", all_trending_functions_count)

        # Profiling functions have a resolution of ~10ms. To increase the confidence
        # of the results, the caller can specify a min threshold for the trend difference.
        threshold = data.get("threshold")
        if threshold is not None:
            trending_functions = [
                data
                for data in trending_functions
                if abs(data["trend_difference"]) >= threshold * 1e6
            ]

        filtered_trending_functions_count = all_trending_functions_count - len(trending_functions)
        set_measurement(
            "profiling.top_functions.below_threshold", filtered_trending_functions_count
        )

        # Make sure to sort the results so that it's in order of largest change
        # to smallest change (ASC/DESC depends on the trend type)
        trending_functions.sort(
            key=lambda function: function["trend_percentage"],
            reverse=data["trend"] is TrendType.REGRESSION,
        )

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
                formatted_result = {
                    "stats": stats_data[key][data["function"]],
                    "worst": [
                        (ts, data[0]["count"])
                        for (ts, data) in stats_data[key]["worst()"]["data"]
                        if data[0]["count"]  # filter out entries without an example
                    ],
                }
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
                            # "unweighted_t_value",  # unneeded, but also can error because of infs
                        ]
                    }
                )
                formatted_result.update(
                    {
                        k: functions[key][k]
                        for k in ["fingerprint", "package", "function", "count()", "examples()"]
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
