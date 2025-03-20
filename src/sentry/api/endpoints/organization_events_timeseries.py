from collections.abc import Mapping
from datetime import timedelta
from typing import Any, NotRequired, TypedDict

import sentry_sdk
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.endpoints.organization_events_stats import (
    ALLOWED_EVENTS_STATS_REFERRERS,
    METRICS_ENHANCED_REFERRERS,
    SENTRY_BACKEND_REFERRERS,
)
from sentry.constants import MAX_TOP_EVENTS
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba import (
    discover,
    errors,
    functions,
    metrics_enhanced_performance,
    metrics_performance,
    ourlogs,
    spans_eap,
    spans_indexed,
    spans_metrics,
    spans_rpc,
    transactions,
    uptime_checks,
)
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer
from sentry.snuba.utils import DATASET_LABELS
from sentry.utils.snuba import SnubaTSResult

TOP_EVENTS_DATASETS = {
    discover,
    functions,
    metrics_performance,
    metrics_enhanced_performance,
    spans_indexed,
    spans_metrics,
    spans_eap,
    errors,
    transactions,
}


class StatsMeta(TypedDict):
    dataset: str
    start: float
    end: float


class Row(TypedDict):
    timestamp: float
    value: float


class SeriesMeta(TypedDict):
    order: NotRequired[int]
    isOther: NotRequired[str]
    valueUnit: NotRequired[str]
    valueType: str
    interval: float


class TimeSeries(TypedDict):
    values: list[Row]
    axis: str
    groupBy: NotRequired[list[str]]
    meta: SeriesMeta


class StatsResponse(TypedDict):
    meta: StatsMeta
    timeseries: list[TimeSeries]


@region_silo_endpoint
class OrganizationEventsTimeseriesEndpoint(OrganizationEventsV2EndpointBase):
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

            metrics_enhanced = dataset in {metrics_performance, metrics_enhanced_performance}
            use_rpc = dataset in {spans_indexed, ourlogs, uptime_checks}

            sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)
            try:
                snuba_params = self.get_snuba_params(
                    # old events-stats had global_check on False for v1, trying it off to see if that works for our
                    # new usage
                    request,
                    organization,
                    check_global_views=True,
                )
            except NoProjects:
                return Response([], status=200)

        try:
            self.validate_comparison_delta(comparison_delta, snuba_params, organization)
            rollup = self.get_rollup(request, snuba_params, top_events, use_rpc)
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
            )
            return Response(
                self.serialize_stats_data(events_stats, axes, snuba_params, rollup, dataset),
                status=200,
            )
        except ValidationError:
            return Response({"detail": "Comparison period is outside retention window"}, status=400)

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
    ) -> SnubaTSResult | dict[str, SnubaTSResult]:
        allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"
        include_other = request.GET.get("excludeOther") != "1"
        referrer = request.GET.get("referrer")
        referrer = (
            referrer
            if referrer in ALLOWED_EVENTS_STATS_REFERRERS.union(METRICS_ENHANCED_REFERRERS)
            else Referrer.API_ORGANIZATION_EVENT_STATS.value
        )
        query_source = self.get_request_querysource(request, referrer)

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

        if top_events > 0:
            if dataset == spans_indexed:
                return spans_rpc.run_top_events_timeseries_query(
                    params=snuba_params,
                    query_string=query,
                    y_axes=query_columns,
                    raw_groupby=self.get_field_list(organization, request),
                    orderby=self.get_orderby(request),
                    limit=top_events,
                    referrer=referrer,
                    granularity_secs=rollup,
                    config=SearchResolverConfig(
                        auto_fields=False,
                        use_aggregate_conditions=True,
                    ),
                )
            return dataset.top_events_timeseries(
                timeseries_columns=query_columns,
                selected_columns=self.get_field_list(organization, request),
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
                fallback_to_transactions=features.has(
                    "organizations:performance-discover-dataset-selector",
                    organization,
                    actor=request.user,
                ),
            )

        if dataset == spans_indexed:
            return spans_rpc.run_timeseries_query(
                params=snuba_params,
                query_string=query,
                y_axes=query_columns,
                granularity_secs=rollup,
                referrer=referrer,
                config=SearchResolverConfig(
                    auto_fields=False,
                    use_aggregate_conditions=True,
                ),
                comparison_delta=comparison_delta,
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
            fallback_to_transactions=features.has(
                "organizations:performance-discover-dataset-selector",
                organization,
                actor=request.user,
            ),
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
        response = StatsResponse(
            meta=StatsMeta(
                dataset=DATASET_LABELS[dataset],
                start=snuba_params.start_date.timestamp() * 1000,
                end=snuba_params.end_date.timestamp() * 1000,
            ),
            timeseries=self.serialize_result(result, axes, rollup),
        )
        return response

    def serialize_result(
        self, result: SnubaTSResult | dict[str, SnubaTSResult], axes: list[str], rollup: int
    ) -> list[TimeSeries]:
        serialized_result = []
        if isinstance(result, SnubaTSResult):
            for axis in axes:
                unit, field_type = self.get_unit_and_type(axis, result.data["meta"]["fields"][axis])
                serialized_result.extend(
                    [
                        TimeSeries(
                            values=[
                                Row(timestamp=row["time"] * 1000, value=row.get(axis, 0))
                                for row in result.data["data"]
                            ],
                            axis=axis,
                            meta=SeriesMeta(
                                valueUnit=unit,
                                valueType=field_type,
                                interval=rollup * 1000,
                            ),
                        )
                    ]
                )
        else:
            for key, value in result.items():
                for axis in axes:
                    unit, field_type = self.get_unit_and_type(
                        axis, value.data["meta"]["fields"][axis]
                    )
                    serialized_result.extend(
                        [
                            TimeSeries(
                                values=[
                                    Row(timestamp=row["time"] * 1000, value=row.get(axis, 0))
                                    for row in value.data["data"]
                                ],
                                axis=axis,
                                groupBy=value.data.get("groupby", {}),
                                meta=SeriesMeta(
                                    order=value.data["order"],
                                    isOther=value.data.get("is_other", False),
                                    valueUnit=unit,
                                    valueType=field_type,
                                    interval=rollup * 1000,
                                ),
                            )
                        ]
                    )
        return serialized_result
