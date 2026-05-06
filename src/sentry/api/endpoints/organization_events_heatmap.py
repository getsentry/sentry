from typing import Any, NotRequired, TypedDict

import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.fields import parse_function
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.types.ratelimit import RateLimit, RateLimitCategory

MAX_BUCKETS = 10_000
HEATMAP_DATASETS = {TraceMetrics}


class AxisMeta(TypedDict):
    name: str
    start: float | None
    end: float | None
    bucketCount: NotRequired[int]
    bucketSize: NotRequired[float | int]


class HeatMapMeta(TypedDict):
    dataset: str
    xAxis: AxisMeta
    yAxis: AxisMeta
    zAxis: AxisMeta


class HeatMap(TypedDict):
    xAxis: float
    yAxis: float
    zAxis: float


class HeatmapResponse(TypedDict):
    meta: HeatMapMeta
    values: list[HeatMap]


EMPTY_HEATMAP_RESPONSE: dict[str, Any] = {"heatmap": []}


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationEventsHeatmapEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    enforce_rate_limit = True

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=30, window=1, concurrent_limit=15),
                RateLimitCategory.USER: RateLimit(limit=30, window=1, concurrent_limit=15),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=30, window=1, concurrent_limit=15),
            }
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieves explore data for a given organization as a heatmap.
        """
        if not features.has(
            "organizations:data-browsing-heat-map-widget", organization, actor=request.user
        ):
            return Response(status=404)
        with sentry_sdk.start_span(op="discover.endpoint", name="filter_params") as span:
            span.set_data("organization", organization)

            dataset = self.get_dataset(request, organization)
            if dataset not in HEATMAP_DATASETS:
                raise ParseError(f"{dataset} is not supported on this endpoint")

            try:
                snuba_params = self.get_snuba_params(
                    request,
                    organization,
                )
            except NoProjects:
                return Response(EMPTY_HEATMAP_RESPONSE, status=200)

            # For now these three fields are locked to time, value, and count()
            xAxis = request.GET.get("xAxis", "time")
            if xAxis != "time":
                raise ParseError("xAxis can currently only be `time`")

            yAxis = request.GET.get("yAxis", "value")
            if yAxis != "value":
                raise ParseError("yAxis can currently only be `value`")

            zAxis = request.GET.get("zAxis", "count()")
            if zAxis != "count()":
                raise ParseError("zAxis can currently only be `count()`")
            z_function, _, _ = parse_function(zAxis)

            xBuckets = request.GET.get("xBuckets")
            if xBuckets is None or not xBuckets.isnumeric():
                raise ParseError("xBuckets must be a number")
            else:
                x_buckets = int(xBuckets)
                if x_buckets <= 0:
                    raise ParseError("xBuckets must be greater than 0")

            yBuckets = request.GET.get("yBuckets")
            if yBuckets is None or not yBuckets.isnumeric():
                raise ParseError("yBuckets must be a number")
            else:
                y_buckets = int(yBuckets)
                if y_buckets <= 0:
                    raise ParseError("yBuckets must be greater than 0")

            # Leaving it as this even though we can query more buckets, just want to do some testing first
            if x_buckets * y_buckets > MAX_BUCKETS:
                raise ParseError(f"xBuckets * yBuckets must be less than {MAX_BUCKETS}")

            snuba_params.granularity_secs = int(
                (snuba_params.date_range.total_seconds()) // x_buckets
            )
            query = request.GET.get("query", "")

        with handle_query_errors():
            bucket_ranges = self.query_y_bucket_ranges(snuba_params, dataset, query, yAxis)
            if bucket_ranges[0] != bucket_ranges[1]:
                # (Max - min)/y_buckets = size of each bucket
                bucket_size = (bucket_ranges[1] - bucket_ranges[0]) / y_buckets
                yAxes = {}
                for current_bucket in range(y_buckets):
                    lower_bound = bucket_ranges[0] + current_bucket * bucket_size
                    upper_bound = bucket_ranges[0] + (current_bucket + 1) * bucket_size
                    if current_bucket == y_buckets - 1:
                        yAxes[lower_bound] = f"{z_function}_if(`{yAxis}:>={lower_bound}`, {yAxis})"
                    else:
                        yAxes[lower_bound] = (
                            f"{z_function}_if(`{yAxis}:>={lower_bound} AND {yAxis}:<{upper_bound}`, {yAxis})"
                        )
            else:
                # if max == min, then just have 1 bucket
                bucket_size = 0
                yAxes = {
                    bucket_ranges[0]: f"{z_function}_if(`{yAxis}:{bucket_ranges[0]}`, {yAxis})"
                }

            result = dataset.run_timeseries_query(
                params=snuba_params,
                query_string=query,
                y_axes=yAxes.values(),
                referrer=Referrer.API_EXPLORE_HEATMAP_QUERY_DATA.value,
                config=SearchResolverConfig(),
                sampling_mode=snuba_params.sampling_mode,
            )

            heatmap = []
            for row in result.data["data"]:
                for y, axis in yAxes.items():
                    # just like with timeseries, multiply times by 1000 so they're in ms
                    heatmap.append(HeatMap(xAxis=row["time"] * 1000, yAxis=y, zAxis=row[axis]))

            # Calculate the min&max z Value
            if len(heatmap) > 0:
                min_z_value, max_z_value = heatmap[0]["zAxis"], heatmap[0]["zAxis"]
                for row in heatmap[1:]:
                    if row["zAxis"] > max_z_value:
                        max_z_value = row["zAxis"]
                    if row["zAxis"] < min_z_value:
                        min_z_value = row["zAxis"]
            else:
                min_z_value, max_z_value = None, None

            return Response(
                HeatmapResponse(
                    meta=HeatMapMeta(
                        dataset="tracemetrics",
                        xAxis=AxisMeta(
                            name=xAxis,
                            start=snuba_params.start_date.timestamp() * 1000,
                            end=snuba_params.end_date.timestamp() * 1000,
                            bucketCount=x_buckets,
                            bucketSize=snuba_params.granularity_secs,
                        ),
                        yAxis=AxisMeta(
                            name=yAxis,
                            start=bucket_ranges[0],
                            end=bucket_ranges[1],
                            bucketCount=y_buckets,
                            bucketSize=bucket_size,
                        ),
                        zAxis=AxisMeta(
                            name=zAxis,
                            start=min_z_value,
                            end=max_z_value,
                        ),
                    ),
                    values=heatmap,
                ),
                status=200,
            )

    def query_y_bucket_ranges(
        self, snuba_params: SnubaParams, dataset: Any, query: str, yAxis: str
    ) -> tuple[float, float]:
        """Determine across all the x buckets what ranges we see the y value go to so we can use that to make the full
        heatmap"""
        min_y = f"min({yAxis})"
        max_y = f"max({yAxis})"
        columns = [min_y, max_y]
        # Time is the only accepted xAxis currently so make a timeseries request
        result = dataset.run_timeseries_query(
            params=snuba_params,
            query_string=query,
            y_axes=columns,
            referrer=Referrer.API_EXPLORE_HEATMAP_FIND_Y_BOUNDS.value,
            # Don't zerofill so we don't autoinclude 0 as a minimum
            config=SearchResolverConfig(zerofill_timeseries=False),
            sampling_mode=snuba_params.sampling_mode,
        )
        if len(result.data["data"]) == 0:
            return 0, 0
        min_value, max_value = None, None
        for row in result.data["data"]:
            if min_value is None:
                min_value = row[min_y]
            elif row[min_y] is not None and row[min_y] < min_value:
                min_value = row[min_y]
            if max_value is None:
                max_value = row[max_y]
            if row[max_y] is not None and row[max_y] > max_value:
                max_value = row[max_y]

        if min_value is None:
            min_value = 0
        if max_value is None:
            max_value = 0

        return min_value, max_value
