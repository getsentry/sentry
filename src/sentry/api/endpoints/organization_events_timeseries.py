import logging
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any

import sentry_sdk
from django.db import connections
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import traces

from sentry import analytics, features, quotas
from sentry.analytics.events.agent_monitoring_events import AgentMonitoringQuery
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events_stats import SENTRY_BACKEND_REFERRERS
from sentry.api.endpoints.timeseries import (
    EMPTY_STATS_RESPONSE,
    INGESTION_DELAY,
    BucketBoundaries,
    Row,
    SeriesMeta,
    StatsMeta,
    StatsResponse,
    TimeSeries,
)
from sentry.api.helpers.ingestion_delay import (
    get_ingestion_delay_status,
    serialize_ingestion_status,
)
from sentry.api.helpers.timeseries_transformations import Transformation, get_transformations
from sentry.api.utils import handle_query_errors
from sentry.apidocs import constants as api_constants
from sentry.apidocs.examples.discover_performance_examples import DiscoverAndPerformanceExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.cache import default_cache
from sentry.constants import MAX_TOP_EVENTS
from sentry.explore.models import ExploreSavedFormula, ExploreSavedQueryDataset
from sentry.ingestion_delay.status import IngestionDelayStatus
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.search.eap.preprod_size.config import PreprodSizeSearchResolverConfig
from sentry.search.eap.trace_metrics.config import (
    TraceMetricsSearchResolverConfig,
    get_trace_metric_from_request,
)
from sentry.search.eap.types import AdditionalQueries, SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba import (
    discover,
    errors,
    functions,
    metrics_enhanced_performance,
    metrics_performance,
    spans_metrics,
    transactions,
)
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.preprod_size import PreprodSize
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer, is_valid_referrer
from sentry.snuba.rpc_dataset_common import RPCBase
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.snuba.utils import DATASET_LABELS, RPC_DATASETS
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.sdk import sdk_logger
from sentry.utils.snuba import SnubaTSResult

TOP_EVENTS_DATASETS = {
    discover,
    functions,
    metrics_performance,
    metrics_enhanced_performance,
    spans_metrics,
    Spans,
    OurLogs,
    PreprodSize,
    TraceMetrics,
    errors,
    transactions,
}
DATASET_TO_FORMULA_DATASET = {
    Spans: ExploreSavedQueryDataset.SPANS,
    OurLogs: ExploreSavedQueryDataset.OURLOGS,
    TraceMetrics: ExploreSavedQueryDataset.METRICS,
}

logger = logging.getLogger(__name__)

INGESTION_DELAY_TIMEOUT = 1.0  # p99 returns in less than 1 second
INCREMENTAL_CACHE_KEY = "timeseries:{dataset_label}:{query_string}:{columns}:{rollup}:{projects}"
# chosen arbitrarily, can tune later
INCREMENTAL_CACHE_TTL = int(timedelta(hours=24).total_seconds())
# We can only store 50mb in cache, a timestamp & 1 aggregate is about 52 bytes, s o the actual max is closer to one
# million, doing 500k so we have room to grow
MAX_CACHE_LENGTH = 500_000


def _get_ingestion_delay_status_in_thread(
    dataset: type[RPCBase], snuba_params: SnubaParams
) -> IngestionDelayStatus | None:
    with sentry_sdk.new_scope():
        try:
            return get_ingestion_delay_status(dataset, snuba_params)
        finally:
            connections.close_all()


def null_zero(value: float) -> float | None:
    if value == 0:
        return None
    else:
        return value


def cache_candidate(
    dataset: Any,
    snuba_params: SnubaParams,
    query: str,
    query_columns: list[str],
    rollup: int,
    top_events: int,
) -> bool:
    """Check if this query is a good candidate for caching

    We're starting very conservatively so we only want to cache the homepage query for the explore page basically
    We want to go off the shape of the query since it can be made throughout the application
    """
    if (
        dataset == Spans
        and query == ""
        and query_columns == ["count(span.duration)"]
        and rollup in [1800, 10_800]
        and top_events == 0
    ):
        return True
    return False


def create_cache_key(
    dataset: Any, snuba_params: SnubaParams, query: str, query_columns: list[str], rollup: int
) -> str:
    """Create a cache key, currently this assumes we're only caching the home page query on explore"""
    return INCREMENTAL_CACHE_KEY.format(
        dataset_label=type(dataset).__name__,
        query_string=query,
        columns=",".join(query_columns),
        rollup=rollup,
        projects=",".join([str(pid) for pid in snuba_params.project_ids]),
    )


def update_result_with_cache(
    cache_key: str,
    cached: Any,
    result: Any,
    cached_timestamps: list[int] | None,
    original_start: datetime | None,
    snuba_params: SnubaParams,
    axis: str,
) -> None:
    final_result = []
    to_update = {}
    if cached and cached_timestamps:
        for row in result.data["data"]:
            if row["time"] in cached_timestamps:
                to_update[row["time"]] = row
            else:
                cached.append(row)
    else:
        cached = result.data["data"]

    processed = result.data["processed_timeseries"]
    for row, sample_count, sampling_rate, confidence in zip(
        result.data["data"],
        processed.sample_count,
        processed.sampling_rate,
        processed.confidence,
    ):
        label = next(key for key in sample_count if key != "time")
        row["sampleCount"] = sample_count.get(label)
        row["sampleRate"] = sampling_rate.get(label)
        row["confidence"] = confidence.get(label)

    for index, row in enumerate(cached):
        if row["time"] in to_update:
            cached[index].update(to_update[row["time"]])
    start = original_start if original_start is not None else snuba_params.start_date
    for row in cached:
        if start.timestamp() <= row["time"] <= snuba_params.end_date.timestamp():
            final_result.append(row)
    processed.sample_count = [
        {"time": row["time"], axis: row.get("sampleCount")} for row in final_result
    ]
    processed.sampling_rate = [
        {"time": row["time"], axis: row.get("sampleRate")} for row in final_result
    ]
    processed.confidence = [
        {"time": row["time"], axis: row.get("confidence")} for row in final_result
    ]
    if len(cached) > MAX_CACHE_LENGTH:
        cached = cached[MAX_CACHE_LENGTH:]
    default_cache.set(cache_key, cached, timeout=INCREMENTAL_CACHE_TTL)
    result.data["data"] = final_result
    # Retore the original_start
    if original_start:
        snuba_params.start = original_start


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationEventsTimeseriesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
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

    def get_request_querysource(self, request: Request, referrer: str) -> QuerySource:
        if referrer in SENTRY_BACKEND_REFERRERS:
            return QuerySource.SENTRY_BACKEND
        else:
            return self.get_request_source(request)

    def get_top_events(self, request: Request) -> int:
        if "topEvents" in request.GET:
            try:
                top_events = int(request.GET.get("topEvents", 0))
            except ValueError:
                raise ParseError(detail="topEvents must be an integer")
            if top_events > MAX_TOP_EVENTS:
                raise ParseError(detail=f"Can only get up to {MAX_TOP_EVENTS} top events")
            elif top_events <= 0:
                raise ParseError(detail="topEvents needs to be at least 1")

            return top_events
        else:
            return 0

    def get_comparison_delta(self, request: Request) -> timedelta | None:
        if "comparisonDelta" in request.GET:
            try:
                return timedelta(seconds=int(request.GET["comparisonDelta"]))
            except ValueError:
                raise ParseError(detail="comparisonDelta must be an integer")
        else:
            return None

    @extend_schema(
        operation_id="listOrganizationEventsTimeseries",
        summary="Query Explore Events in Timeseries Format",
        parameters=[
            GlobalParams.END,
            GlobalParams.ENVIRONMENT,
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.START,
            GlobalParams.STATS_PERIOD,
            VisibilityParams.TOP_EVENTS,
            VisibilityParams.COMPARISON_DELTA,
            VisibilityParams.DATASET,
            VisibilityParams.INTERVAL,
            VisibilityParams.SORT,
            VisibilityParams.GROUP_BY,
            VisibilityParams.Y_AXIS,
            VisibilityParams.EXPLORE_QUERY,
            VisibilityParams.DISABLE_AGGREGATE_EXTRAPOLATION,
            VisibilityParams.PREVENT_METRIC_AGGREGATES,
            VisibilityParams.EXCLUDE_OTHER,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsTimeseriesResponse", StatsResponse
            ),
            400: OpenApiResponse(description="Invalid Query"),
            404: api_constants.RESPONSE_NOT_FOUND,
        },
        examples=DiscoverAndPerformanceExamples.QUERY_TIMESERIES,
    )
    def get(self, request: Request, organization: Organization) -> Response[StatsResponse]:
        """
        Retrieves explore data for a given organization as a timeseries.

        This endpoint can return timeseries for either 1 or many axis, and results grouped to the top events depending
        on the parameters passed

        **Note**: For queries extending past `30d`, spanning billions of rows, or running on projects with low
        sample rates, the aggregation `yAxis=count_unique()` and filters on high-cardinality
        fields (such as `query=user.id:bc`) will not return accurate results. Use these queries for rough
        estimation only.
        """
        with traces.start_span(
            name="filter_params",
            attributes={
                "sentry.op": "discover.endpoint",
                "organization": repr(organization),
            },
        ):
            top_events = self.get_top_events(request)
            comparison_delta = self.get_comparison_delta(request)
            transformations = {}
            if features.has(
                "organizations:explore-interpolation-and-smoothing",
                organization,
                actor=request.user,
            ):
                transformations = get_transformations(request)

            dataset = self.get_dataset(request, organization)
            # Add more here until top events is supported on all the datasets
            if top_events > 0:
                if dataset not in TOP_EVENTS_DATASETS:
                    raise ParseError(detail=f"{dataset} doesn't support topEvents yet")

            metrics_enhanced = dataset in {
                metrics_performance,
                metrics_enhanced_performance,
            }
            use_rpc = dataset in RPC_DATASETS

            sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)
            sentry_sdk.set_attribute("performance.metrics_enhanced", metrics_enhanced)
            try:
                snuba_params = self.get_snuba_params(
                    request,
                    organization,
                )
            except NoProjects:
                return Response(EMPTY_STATS_RESPONSE, status=200)
            additional_queries = self.get_additional_queries(request)

        with handle_query_errors():
            self.validate_comparison_delta(comparison_delta, snuba_params, organization)
            rollup = self.get_rollup(request, snuba_params, top_events, use_rpc)
            snuba_params.granularity_secs = rollup
            axes = request.GET.getlist("yAxis", ["count()"])
            include_measured_ingestion_delay_metadata = features.has(
                "organizations:measured-ingestion-delay-metadata",
                organization,
                actor=request.user,
            )
            # Only the EAP RPC datasets allow measured ingestion delay metadata.
            pool = ContextPropagatingThreadPoolExecutor(max_workers=1)
            try:
                ingestion_delay_future = (
                    pool.submit(_get_ingestion_delay_status_in_thread, dataset, snuba_params)
                    if include_measured_ingestion_delay_metadata
                    and isinstance(dataset, type)
                    and issubclass(dataset, RPCBase)
                    else None
                )
                events_stats = self.get_event_stats(
                    request,
                    organization,
                    top_events,
                    dataset,
                    axes,
                    request.GET.get("query", ""),
                    snuba_params,
                    rollup,
                    comparison_delta,
                    additional_queries,
                    transformations,
                )
                ingestion_delay_status = None
                if ingestion_delay_future is not None:
                    # Ingestion delay is non-critical, so don't fail the request if it fails.
                    try:
                        ingestion_delay_status = ingestion_delay_future.result(
                            timeout=INGESTION_DELAY_TIMEOUT
                        )
                    except Exception:
                        logger.warning("Failed to fetch ingestion delay status", exc_info=True)
            finally:
                pool.shutdown(wait=False)
            return Response(
                self.serialize_stats_data(
                    events_stats,
                    axes,
                    snuba_params,
                    rollup,
                    dataset,
                    organization,
                    ingestion_delay_status,
                ),
                status=200,
            )

    def get_rpc_config(
        self, dataset: Any, request: Request, organization: Organization
    ) -> SearchResolverConfig:
        if dataset not in RPC_DATASETS:
            raise NotImplementedError

        extrapolation_mode = self.get_extrapolation_mode(request)
        disable_aggregate_extrapolation = (
            request.GET.get("disableAggregateExtrapolation", "0") == "1"
        )
        disable_array_attributes = not features.has(
            "organizations:trace-item-details-array-fields",
            organization,
            actor=request.user,
        )

        if dataset in DATASET_TO_FORMULA_DATASET and features.has(
            "organizations:explore-saved-formulas", organization, actor=request.user
        ):
            saved_formulas = {
                formula.name: formula
                for formula in ExploreSavedFormula.objects.filter(
                    organization=organization,
                    dataset=DATASET_TO_FORMULA_DATASET[dataset],
                    prebuilt_deleted=False,
                ).prefetch_related("variables")
            }
        else:
            saved_formulas = None

        if dataset == TraceMetrics:
            # tracemetrics uses aggregate conditions
            return TraceMetricsSearchResolverConfig(
                metric=get_trace_metric_from_request(request),
                auto_fields=False,
                use_aggregate_conditions=True,
                disable_aggregate_extrapolation=disable_aggregate_extrapolation,
                extrapolation_mode=extrapolation_mode,
                disable_array_attributes=disable_array_attributes,
                saved_formulas=saved_formulas,
            )
        elif dataset == PreprodSize:
            return PreprodSizeSearchResolverConfig(
                auto_fields=False,
                use_aggregate_conditions=True,
                disable_aggregate_extrapolation=disable_aggregate_extrapolation,
                extrapolation_mode=extrapolation_mode,
                disable_array_attributes=disable_array_attributes,
            )
        else:
            return SearchResolverConfig(
                auto_fields=False,
                use_aggregate_conditions=True,
                disable_aggregate_extrapolation=disable_aggregate_extrapolation,
                extrapolation_mode=extrapolation_mode,
                disable_array_attributes=disable_array_attributes,
                disable_deprecated_functions=(
                    dataset == Spans
                    and features.has(
                        "organizations:explore-disable-deprecated-if-functions",
                        organization,
                        actor=request.user,
                    )
                ),
                saved_formulas=saved_formulas if dataset in [Spans, OurLogs] else None,
            )

    def get_event_stats(
        self,
        request: Request,
        organization: Organization,
        top_events: int,
        dataset: Any,
        query_columns: list[str],
        query: str,
        snuba_params: SnubaParams,
        rollup: int,
        comparison_delta: timedelta | None,
        additional_queries: AdditionalQueries,
        transformations: Mapping[int, Sequence[Transformation]] | None = None,
    ) -> SnubaTSResult | dict[str, SnubaTSResult]:
        allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"
        include_other = request.GET.get("excludeOther") != "1"
        referrer = request.GET.get("referrer")
        sentry_sdk.set_attribute("query.raw_referrer", referrer or "")
        # Force the referrer to "api.auth-token.events" for events requests authorized through a bearer token
        if request.auth:
            referrer = Referrer.API_AUTH_TOKEN_EVENTS.value
        elif referrer is None or not referrer:
            referrer = Referrer.API_ORGANIZATION_EVENTS.value
        elif not is_valid_referrer(referrer):
            referrer = Referrer.API_ORGANIZATION_EVENTS.value

        sentry_sdk.set_tag("query.referrer", referrer)
        sentry_sdk.set_attribute("query.referrer", referrer)

        query_source = self.get_request_querysource(request, referrer)
        sentry_sdk.set_tag("query.query_source", query_source.value)
        sentry_sdk.set_attribute("query.query_source", query_source.value)

        # We are going to start ratcheting usage of this endpoint for legacy
        # datasets. For now, log usage from blocked orgs but still permit the
        # request.
        is_external_api_request = request.auth and referrer == Referrer.API_AUTH_TOKEN_EVENTS
        is_legacy_dataset = dataset in {transactions, discover, metrics_enhanced_performance}
        is_blocked = features.has(
            "organizations:events-endpoint-transactions-discover-blocked",
            organization,
            actor=request.user,
        )
        if is_external_api_request and is_legacy_dataset and is_blocked:
            sdk_logger.warning(
                "events endpoint called by blocked org",
                attributes={
                    "org_id": organization.id,
                    "org_slug": organization.slug,
                    "effective_dataset": DATASET_LABELS.get(dataset, ""),
                    "requested_dataset": request.GET.get("dataset", ""),
                    "endpoint_name": "organization-events-timeseries",
                },
            )
        incremental_loading = features.has(
            "organizations:explore-incremental-timeseries",
            organization,
            actor=request.user,
        )
        # skipCache only applies while incremental caching is enabled.
        skip_cache = incremental_loading and request.GET.get("skipCache") == "1"
        is_cache_candidate = False
        if incremental_loading and not skip_cache:
            with traces.start_span("get_cache"):
                if is_cache_candidate := cache_candidate(
                    dataset, snuba_params, query, query_columns, rollup, top_events
                ):
                    original_start = None
                    cached_timestamps = None
                    cache_key = create_cache_key(
                        dataset, snuba_params, query, query_columns, rollup
                    )
                    if cached := default_cache.get(cache_key):
                        cached_timestamps = sorted([item["time"] for item in cached])
                        # Don't use the cache if we haven't queried the start before
                        # If this works well we can fork two queries in the future but keeping it simple for now
                        if cached_timestamps[0] > snuba_params.start_date.timestamp():
                            is_cache_candidate = False
                        # still query the last 3 timestamps
                        elif len(cached_timestamps) > 3:
                            original_start = snuba_params.start_date
                            snuba_params.start = datetime.fromtimestamp(
                                cached_timestamps[-3], tz=timezone.utc
                            )

        self._emit_analytics_event(organization, referrer)

        if top_events > 0:
            raw_groupby = self.get_field_list(organization, request, param_name="groupBy")
            raw_orderby = self.get_orderby(request)
            if len(raw_groupby) == 0:
                raise ParseError("groupBy is a required parameter when doing topEvents")
            if "timestamp" in raw_groupby:
                raise ParseError("Cannot group by timestamp")
            if raw_orderby:
                if "timestamp" in [col.strip("-") for col in raw_orderby]:
                    raise ParseError("Cannot order by timestamp")
            if dataset in RPC_DATASETS:
                return dataset.run_top_events_timeseries_query(
                    params=snuba_params,
                    query_string=query,
                    y_axes=query_columns,
                    raw_groupby=raw_groupby,
                    orderby=self.get_orderby(request),
                    limit=top_events,
                    include_other=include_other,
                    referrer=referrer,
                    config=self.get_rpc_config(dataset, request, organization),
                    sampling_mode=snuba_params.sampling_mode,
                    equations=self.get_equation_list(organization, request, param_name="groupBy"),
                    additional_queries=additional_queries,
                    transformations=transformations,
                )
            return dataset.top_events_timeseries(
                timeseries_columns=query_columns,
                selected_columns=raw_groupby,
                equations=self.get_equation_list(organization, request),
                user_query=query,
                snuba_params=snuba_params,
                orderby=self.get_orderby(request),
                rollup=rollup,
                limit=top_events,
                organization=organization,
                referrer=referrer + ".find-topn",
                allow_empty=False,
                zerofill_results=True,
                include_other=include_other,
                query_source=query_source,
                transform_alias_to_input_format=True,
                fallback_to_transactions=True,
            )

        if dataset in RPC_DATASETS:
            result = dataset.run_timeseries_query(
                params=snuba_params,
                query_string=query,
                y_axes=query_columns,
                referrer=referrer,
                config=self.get_rpc_config(dataset, request, organization),
                sampling_mode=snuba_params.sampling_mode,
                comparison_delta=comparison_delta,
                additional_queries=additional_queries,
                transformations=transformations,
            )
            if incremental_loading and not skip_cache and is_cache_candidate:
                with traces.start_span("set_cache"):
                    # Query columns 0 is fine here since we only have 1 cache candidate right now
                    update_result_with_cache(
                        cache_key,
                        cached,
                        result,
                        cached_timestamps,
                        original_start,
                        snuba_params,
                        query_columns[0],
                    )
            return result

        return dataset.timeseries_query(
            selected_columns=query_columns,
            query=query,
            snuba_params=snuba_params,
            rollup=rollup,
            referrer=referrer,
            zerofill_results=True,
            comparison_delta=comparison_delta,
            allow_metric_aggregates=allow_metric_aggregates,
            has_metrics=True,
            query_source=query_source,
            fallback_to_transactions=True,
            transform_alias_to_input_format=True,
        )

    def serialize_stats_data(
        self,
        result: SnubaTSResult | dict[str, SnubaTSResult],
        axes: list[str],
        snuba_params: SnubaParams,
        rollup: int,
        dataset,
        organization: Organization,
        ingestion_delay_status: IngestionDelayStatus | None = None,
    ) -> StatsResponse:
        # We need the current timestamp for the Ingestion Delay incomplete reason
        now = datetime.now().timestamp()
        complete_through = now - INGESTION_DELAY
        stats_meta = StatsMeta(
            dataset=DATASET_LABELS[dataset],
            start=snuba_params.start_date.timestamp() * 1000,
            end=snuba_params.end_date.timestamp() * 1000,
        )
        if snuba_params.debug:
            debug_info = None
            if isinstance(result, SnubaTSResult) and "debug_info" in result.data["meta"]:
                debug_info = result.data["meta"]["debug_info"]
            elif isinstance(result, dict):
                debug_info = {}
                for key, keyed_result in result.items():
                    if "debug_info" in keyed_result.data["meta"]:
                        debug_info[key] = keyed_result.data["meta"]["debug_info"]
            # ignore typing here cause we don't want the openapi docs to include debug_info
            stats_meta["debug_info"] = debug_info  #  type: ignore[typeddict-unknown-key]
        if ingestion_delay_status is not None:
            stats_meta["ingestion"] = serialize_ingestion_status(ingestion_delay_status)
            if ingestion_delay_status.complete_through is not None:
                complete_through = ingestion_delay_status.complete_through.timestamp()

        retention_days = quotas.backend.get_event_retention(organization=organization)
        boundaries = BucketBoundaries(
            now=now,
            complete_through=complete_through,
            retention_start=now - timedelta(days=retention_days).total_seconds()
            if retention_days
            else None,
        )

        response = StatsResponse(
            meta=stats_meta,
            timeSeries=self.serialize_result(result, axes, rollup, boundaries),
        )
        return response

    def serialize_result(
        self,
        result: SnubaTSResult | dict[str, SnubaTSResult],
        axes: list[str],
        rollup: int,
        boundaries: BucketBoundaries,
    ) -> list[TimeSeries]:
        serialized_result = []
        if isinstance(result, SnubaTSResult):
            for axis_index, axis in enumerate(axes):
                serialized_result.append(
                    self.serialize_timeseries(result, axis, rollup, boundaries, axis_index)
                )
        else:
            for key, value in result.items():
                for axis_index, axis in enumerate(axes):
                    serialized_result.append(
                        self.serialize_timeseries(value, axis, rollup, boundaries, axis_index)
                    )
        return serialized_result

    def serialize_timeseries(
        self,
        result: SnubaTSResult,
        axis: str,
        rollup: int,
        boundaries: BucketBoundaries,
        axis_index: int = 0,
    ) -> TimeSeries:
        unit, field_type = self.get_unit_and_type(axis, result.data["meta"]["fields"][axis])
        series_meta = SeriesMeta(
            valueType=field_type,
            valueUnit=unit,
            interval=rollup * 1000,
        )
        if "is_other" in result.data:
            series_meta["isOther"] = result.data["is_other"]
        if "order" in result.data:
            series_meta["order"] = result.data["order"]
        if "full_scan" in result.data["meta"]:
            series_meta["dataScanned"] = "full" if result.data["meta"]["full_scan"] else "partial"

        timeseries = TimeSeries(
            values=[],
            yAxis=axis,
            meta=series_meta,
        )

        timeseries_values = []
        value_column = axis
        transformation_flags = None
        comparison_transformation_flags = None
        if "processed_timeseries" in result.data:
            processed_timeseries = result.data["processed_timeseries"]
            value_column = processed_timeseries.transformation_aliases.get(axis_index, axis)
            transformation_flags = processed_timeseries.transformation_flags.get(axis_index)
            comparison_transformation_flags = processed_timeseries.comparison_transformation_flags
        for index, row in enumerate(result.data["data"]):
            value_row = Row(
                timestamp=row["time"] * 1000, value=row.get(value_column, 0), incomplete=False
            )

            if reason := boundaries.incomplete_reason(row["time"], rollup):
                value_row["incomplete"] = True
                value_row["incompleteReason"] = reason
            if "comparisonCount" in row:
                value_row["comparisonValue"] = row["comparisonCount"]
                if comparison_transformation_flags is not None:
                    value_row["comparisonFilled"] = comparison_transformation_flags.filled[index]
                    value_row["comparisonSmoothed"] = comparison_transformation_flags.smoothed[
                        index
                    ]
            if transformation_flags is not None:
                value_row["filled"] = transformation_flags.filled[index]
                value_row["smoothed"] = transformation_flags.smoothed[index]
            timeseries_values.append(value_row)

        if "groupby" in result.data:
            timeseries["groupBy"] = result.data["groupby"]

        if "processed_timeseries" in result.data:
            processed_timeseries = result.data["processed_timeseries"]
            for value, count, rate, confidence in zip(
                timeseries_values,
                processed_timeseries.sample_count,
                processed_timeseries.sampling_rate,
                processed_timeseries.confidence,
            ):
                value["sampleCount"] = count.get(axis)
                # We want to null sample rates that are 0 since that means we received no data during this bucket
                value["sampleRate"] = null_zero(rate.get(axis))
                value["confidence"] = confidence.get(axis)

        timeseries["values"] = timeseries_values

        return timeseries

    def _emit_analytics_event(self, organization: Organization, referrer: str) -> None:
        if "agent-monitoring" not in referrer:
            return
        try:
            analytics.record(
                AgentMonitoringQuery(
                    organization_id=organization.id,
                    referrer=referrer,
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)
