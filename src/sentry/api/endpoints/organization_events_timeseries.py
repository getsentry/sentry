from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.analytics.events.agent_monitoring_events import AgentMonitoringQuery
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events_stats import SENTRY_BACKEND_REFERRERS
from sentry.api.endpoints.timeseries import (
    EMPTY_STATS_RESPONSE,
    Row,
    SeriesMeta,
    StatsMeta,
    StatsResponse,
    TimeSeries,
)
from sentry.api.utils import handle_query_errors
from sentry.constants import MAX_TOP_EVENTS
from sentry.models.organization import Organization
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
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer, is_valid_referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.snuba.utils import DATASET_LABELS, RPC_DATASETS
from sentry.utils.snuba import SnubaTSResult

TOP_EVENTS_DATASETS = {
    discover,
    functions,
    metrics_performance,
    metrics_enhanced_performance,
    spans_metrics,
    Spans,
    OurLogs,
    TraceMetrics,
    errors,
    transactions,
}

# Assumed ingestion delay for timeseries, this is a static number for now just to match how the frontend was doing it
INGESTION_DELAY = 90
INGESTION_DELAY_MESSAGE = "INCOMPLETE_BUCKET"


def null_zero(value: float) -> float | None:
    if value == 0:
        return None
    else:
        return value


@region_silo_endpoint
class OrganizationEventsTimeseriesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get_features(
        self, organization: Organization, request: Request
    ) -> Mapping[str, bool | None]:
        feature_names = [
            "organizations:performance-use-metrics",
            "organizations:dashboards-mep",
            "organizations:mep-rollout-flag",
        ]
        batch_features = features.batch_has(
            feature_names,
            organization=organization,
            actor=request.user,
        )
        return (
            batch_features.get(f"organization:{organization.id}", {})
            if batch_features is not None
            else {
                feature_name: features.has(
                    feature_name, organization=organization, actor=request.user
                )
                for feature_name in feature_names
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

    def get(self, request: Request, organization: Organization) -> Response:
        with sentry_sdk.start_span(op="discover.endpoint", name="filter_params") as span:
            span.set_data("organization", organization)

            top_events = self.get_top_events(request)
            comparison_delta = self.get_comparison_delta(request)

            dataset = self.get_dataset(request)
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
            )
            return Response(
                self.serialize_stats_data(events_stats, axes, snuba_params, rollup, dataset),
                status=200,
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
    ) -> SnubaTSResult | dict[str, SnubaTSResult]:
        allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"
        include_other = request.GET.get("excludeOther") != "1"
        referrer = request.GET.get("referrer")
        # Force the referrer to "api.auth-token.events" for events requests authorized through a bearer token
        if request.auth:
            referrer = Referrer.API_AUTH_TOKEN_EVENTS.value
        elif referrer is None or not referrer:
            referrer = Referrer.API_ORGANIZATION_EVENTS.value
        elif not is_valid_referrer(referrer):
            referrer = Referrer.API_ORGANIZATION_EVENTS.value
        query_source = self.get_request_querysource(request, referrer)

        self._emit_analytics_event(organization, referrer)

        batch_features = self.get_features(organization, request)
        use_metrics = (
            batch_features.get("organizations:performance-use-metrics", False)
            or batch_features.get("organizations:dashboards-mep", False)
            or (
                batch_features.get("organizations:mep-rollout-flag", False)
                and features.has(
                    "organizations:dynamic-sampling",
                    organization=organization,
                    actor=request.user,
                )
            )
        )

        def get_rpc_config():
            if dataset not in RPC_DATASETS:
                raise NotImplementedError

            extrapolation_mode = self.get_extrapolation_mode(request)

            if dataset == TraceMetrics:
                # tracemetrics uses aggregate conditions
                metric = get_trace_metric_from_request(request)

                return TraceMetricsSearchResolverConfig(
                    metric=metric,
                    auto_fields=False,
                    use_aggregate_conditions=True,
                    disable_aggregate_extrapolation=request.GET.get(
                        "disableAggregateExtrapolation", "0"
                    )
                    == "1",
                    extrapolation_mode=extrapolation_mode,
                )

            return SearchResolverConfig(
                auto_fields=False,
                use_aggregate_conditions=True,
                disable_aggregate_extrapolation=request.GET.get(
                    "disableAggregateExtrapolation", "0"
                )
                == "1",
                extrapolation_mode=extrapolation_mode,
            )

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
                    config=get_rpc_config(),
                    sampling_mode=snuba_params.sampling_mode,
                    equations=self.get_equation_list(organization, request, param_name="groupBy"),
                    additional_queries=additional_queries,
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
            return dataset.run_timeseries_query(
                params=snuba_params,
                query_string=query,
                y_axes=query_columns,
                referrer=referrer,
                config=get_rpc_config(),
                sampling_mode=snuba_params.sampling_mode,
                comparison_delta=comparison_delta,
                additional_queries=additional_queries,
            )

        return dataset.timeseries_query(
            selected_columns=query_columns,
            query=query,
            snuba_params=snuba_params,
            rollup=rollup,
            referrer=referrer,
            zerofill_results=True,
            comparison_delta=comparison_delta,
            allow_metric_aggregates=allow_metric_aggregates,
            has_metrics=use_metrics,
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
    ) -> StatsResponse:
        # We need the current timestamp for the Ingestion Delay incomplete reason
        now = datetime.now().timestamp()
        response = StatsResponse(
            meta=StatsMeta(
                dataset=DATASET_LABELS[dataset],
                start=snuba_params.start_date.timestamp() * 1000,
                end=snuba_params.end_date.timestamp() * 1000,
            ),
            timeSeries=self.serialize_result(result, axes, rollup, now),
        )
        return response

    def serialize_result(
        self,
        result: SnubaTSResult | dict[str, SnubaTSResult],
        axes: list[str],
        rollup: int,
        now: float,
    ) -> list[TimeSeries]:
        serialized_result = []
        if isinstance(result, SnubaTSResult):
            for axis in axes:
                serialized_result.append(self.serialize_timeseries(result, axis, rollup, now))
        else:
            for key, value in result.items():
                for axis in axes:
                    serialized_result.append(self.serialize_timeseries(value, axis, rollup, now))
        return serialized_result

    def serialize_timeseries(
        self, result: SnubaTSResult, axis: str, rollup: int, now: float
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
        for row in result.data["data"]:
            value_row = Row(timestamp=row["time"] * 1000, value=row.get(axis, 0), incomplete=False)

            if incomplete := self.check_incomplete(row, now, rollup):
                value_row["incomplete"] = True
                value_row["incompleteReason"] = incomplete
            if "comparisonCount" in row:
                value_row["comparisonValue"] = row["comparisonCount"]
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
                value["sampleCount"] = count[axis]
                # We want to null sample rates that are 0 since that means we received no data during this bucket
                value["sampleRate"] = null_zero(rate[axis])
                value["confidence"] = confidence[axis]

        timeseries["values"] = timeseries_values

        return timeseries

    def check_incomplete(self, row: dict[str, Any], now: float, rollup: int) -> str | None:
        if row["time"] + rollup >= now - INGESTION_DELAY:
            return INGESTION_DELAY_MESSAGE
        else:
            return None

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
