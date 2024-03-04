import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.apidocs import constants as api_constants
from sentry.apidocs.examples.discover_performance_examples import DiscoverAndPerformanceExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.exceptions import InvalidParams
from sentry.models.dashboard_widget import DashboardWidget, DashboardWidgetTypes
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.snuba import discover, metrics_enhanced_performance, metrics_performance
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.referrer import Referrer
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.snuba import SnubaError

logger = logging.getLogger(__name__)

METRICS_ENHANCED_REFERRERS = {Referrer.API_PERFORMANCE_LANDING_TABLE.value}

ALLOWED_EVENTS_REFERRERS = {
    Referrer.API_ORGANIZATION_EVENTS.value,
    Referrer.API_ORGANIZATION_EVENTS_V2.value,
    Referrer.API_DASHBOARDS_TABLEWIDGET.value,
    Referrer.API_DASHBOARDS_BIGNUMBERWIDGET.value,
    Referrer.API_DISCOVER_TRANSACTIONS_LIST.value,
    Referrer.API_DISCOVER_QUERY_TABLE.value,
    Referrer.API_PERFORMANCE_VITALS_CARDS.value,
    Referrer.API_PERFORMANCE_LANDING_TABLE.value,
    Referrer.API_PERFORMANCE_TRANSACTION_SUMMARY.value,
    Referrer.API_PERFORMANCE_TRANSACTION_SPANS.value,
    Referrer.API_PERFORMANCE_STATUS_BREAKDOWN.value,
    Referrer.API_PERFORMANCE_VITAL_DETAIL.value,
    Referrer.API_PERFORMANCE_DURATIONPERCENTILECHART.value,
    Referrer.API_PROFILING_LANDING_TABLE.value,
    Referrer.API_PROFILING_LANDING_FUNCTIONS_CARD.value,
    Referrer.API_PROFILING_PROFILE_SUMMARY_TOTALS.value,
    Referrer.API_PROFILING_PROFILE_SUMMARY_TABLE.value,
    Referrer.API_PROFILING_PROFILE_SUMMARY_FUNCTIONS_TABLE.value,
    Referrer.API_PROFILING_TRANSACTION_HOVERCARD_FUNCTIONS.value,
    Referrer.API_PROFILING_TRANSACTION_HOVERCARD_LATEST.value,
    Referrer.API_PROFILING_TRANSACTION_HOVERCARD_SLOWEST.value,
    Referrer.API_PROFILING_SUSPECT_FUNCTIONS_LIST.value,
    Referrer.API_PROFILING_SUSPECT_FUNCTIONS_TOTALS.value,
    Referrer.API_PROFILING_SUSPECT_FUNCTIONS_TRANSACTIONS.value,
    Referrer.API_REPLAY_DETAILS_PAGE.value,
    Referrer.API_TRACE_VIEW_SPAN_DETAIL.value,
    Referrer.API_TRACE_VIEW_ERRORS_VIEW.value,
    Referrer.API_TRACE_VIEW_HOVER_CARD.value,
    Referrer.API_ISSUES_ISSUE_EVENTS.value,
    Referrer.API_STARFISH_ENDPOINT_LIST.value,
    Referrer.API_STARFISH_GET_SPAN_ACTIONS.value,
    Referrer.API_STARFISH_GET_SPAN_DOMAINS.value,
    Referrer.API_STARFISH_GET_SPAN_OPERATIONS.value,
    Referrer.API_STARFISH_SIDEBAR_SPAN_METRICS.value,
    Referrer.API_STARFISH_SPAN_CATEGORY_BREAKDOWN.value,
    Referrer.API_STARFISH_SPAN_LIST.value,
    Referrer.API_STARFISH_SPAN_SUMMARY_P95.value,
    Referrer.API_STARFISH_SPAN_SUMMARY_PAGE.value,
    Referrer.API_STARFISH_SPAN_SUMMARY_PANEL.value,
    Referrer.API_STARFISH_SPAN_SUMMARY_TRANSACTIONS.value,
    Referrer.API_STARFISH_SPAN_TRANSACTION_METRICS.value,
    Referrer.API_STARFISH_TOTAL_TIME.value,
    Referrer.API_STARFISH_MOBILE_SCREEN_TABLE.value,
    Referrer.API_STARFISH_MOBILE_SCREEN_BAR_CHART.value,
    Referrer.API_STARFISH_MOBILE_RELEASE_SELECTOR.value,
    Referrer.API_STARFISH_MOBILE_DEVICE_BREAKDOWN.value,
    Referrer.API_STARFISH_MOBILE_EVENT_SAMPLES.value,
    Referrer.API_STARFISH_MOBILE_SCREEN_TOTALS.value,
    Referrer.API_STARFISH_MOBILE_SPAN_TABLE.value,
    Referrer.API_STARFISH_MOBILE_STARTUP_SCREEN_TABLE.value,
    Referrer.API_STARFISH_MOBILE_STARTUP_BAR_CHART.value,
    Referrer.API_STARFISH_MOBILE_STARTUP_SERIES.value,
    Referrer.API_STARFISH_MOBILE_STARTUP_EVENT_SAMPLES.value,
    Referrer.API_STARFISH_MOBILE_STARTUP_SPAN_TABLE.value,
    Referrer.API_STARFISH_MOBILE_STARTUP_LOADED_LIBRARIES.value,
    Referrer.API_STARFISH_MOBILE_STARTUP_TOTALS.value,
}

API_TOKEN_REFERRER = Referrer.API_AUTH_TOKEN_EVENTS.value

RATE_LIMIT = 30
RATE_LIMIT_WINDOW = 1
CONCURRENT_RATE_LIMIT = 15

DEFAULT_RATE_LIMIT = 50
DEFAULT_RATE_LIMIT_WINDOW = 1
DEFAULT_CONCURRENT_RATE_LIMIT = 50

DEFAULT_EVENTS_RATE_LIMIT_CONFIG = {
    "GET": {
        RateLimitCategory.IP: RateLimit(
            DEFAULT_RATE_LIMIT, DEFAULT_RATE_LIMIT_WINDOW, DEFAULT_CONCURRENT_RATE_LIMIT
        ),
        RateLimitCategory.USER: RateLimit(
            DEFAULT_RATE_LIMIT, DEFAULT_RATE_LIMIT_WINDOW, DEFAULT_CONCURRENT_RATE_LIMIT
        ),
        RateLimitCategory.ORGANIZATION: RateLimit(
            DEFAULT_RATE_LIMIT, DEFAULT_RATE_LIMIT_WINDOW, DEFAULT_CONCURRENT_RATE_LIMIT
        ),
    }
}


def rate_limit_events(request: Request, organization_slug=None, *args, **kwargs) -> RateLimitConfig:
    try:
        organization = Organization.objects.get_from_cache(slug=organization_slug)
    except Organization.DoesNotExist:
        return DEFAULT_EVENTS_RATE_LIMIT_CONFIG
    # Check for feature flag to enforce rate limit otherwise use default rate limit
    if features.has("organizations:discover-events-rate-limit", organization, actor=request.user):
        return {
            "GET": {
                RateLimitCategory.IP: RateLimit(
                    RATE_LIMIT, RATE_LIMIT_WINDOW, CONCURRENT_RATE_LIMIT
                ),
                RateLimitCategory.USER: RateLimit(
                    RATE_LIMIT, RATE_LIMIT_WINDOW, CONCURRENT_RATE_LIMIT
                ),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    RATE_LIMIT, RATE_LIMIT_WINDOW, CONCURRENT_RATE_LIMIT
                ),
            }
        }
    return DEFAULT_EVENTS_RATE_LIMIT_CONFIG


@extend_schema(tags=["Discover"])
@region_silo_endpoint
class OrganizationEventsEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    enforce_rate_limit = True

    def rate_limits(*args, **kwargs) -> RateLimitConfig:
        return rate_limit_events(*args, **kwargs)

    def get_features(self, organization: Organization, request: Request) -> Mapping[str, bool]:
        feature_names = [
            "organizations:dashboards-mep",
            "organizations:mep-rollout-flag",
            "organizations:performance-use-metrics",
            "organizations:profiling",
            "organizations:dynamic-sampling",
            "organizations:use-metrics-layer",
            "organizations:starfish-view",
            "organizations:on-demand-metrics-extraction",
            "organizations:on-demand-metrics-extraction-widgets",
            "organizations:on-demand-metrics-extraction-experimental",
        ]
        batch_features = features.batch_has(
            feature_names,
            organization=organization,
            actor=request.user,
        )

        all_features = (
            batch_features.get(f"organization:{organization.id}", {})
            if batch_features is not None
            else {}
        )

        for feature_name in feature_names:
            if feature_name not in all_features:
                all_features[feature_name] = features.has(
                    feature_name, organization=organization, actor=request.user
                )

        return all_features

    @extend_schema(
        operation_id="Query Discover Events in Table Format",
        parameters=[
            GlobalParams.END,
            GlobalParams.ENVIRONMENT,
            GlobalParams.ORG_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.START,
            GlobalParams.STATS_PERIOD,
            VisibilityParams.FIELD,
            VisibilityParams.PER_PAGE,
            VisibilityParams.QUERY,
            VisibilityParams.SORT,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsResponseDict", discover.EventsResponse
            ),
            400: OpenApiResponse(description="Invalid Query"),
            404: api_constants.RESPONSE_NOT_FOUND,
        },
        examples=DiscoverAndPerformanceExamples.QUERY_DISCOVER_EVENTS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Retrieves discover (also known as events) data for a given organization.

        **Eventsv2 Deprecation Note**: Users who may be using the `eventsv2` endpoint should update their requests to the `events` endpoint outline in this document.
        The `eventsv2` endpoint is not a public endpoint and has no guaranteed availability. If you are not making any API calls to `eventsv2`, you can safely ignore this.
        Changes between `eventsv2` and `events` include:
        - Field keys in the response now match the keys in the requested `field` param exactly.
        - The `meta` object in the response now shows types in the nested `field` object.

        Aside from the url change, there are no changes to the request payload itself.

        **Note**: This endpoint is intended to get a table of results, and is not for doing a full export of data sent to
        Sentry.

        The `field` query parameter determines what fields will be selected in the `data` and `meta` keys of the endpoint response.
        - The `data` key contains a list of results row by row that match the `query` made
        - The `meta` key contains information about the response, including the unit or type of the fields requested
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            snuba_params, params = self.get_snuba_dataclass(request, organization)
        except NoProjects:
            return Response(
                {
                    "data": [],
                    "meta": {
                        "tips": {
                            "query": "Need at least one valid project to query.",
                        },
                    },
                }
            )
        except InvalidParams as err:
            raise ParseError(err)

        referrer = request.GET.get("referrer")

        batch_features = self.get_features(organization, request)

        use_metrics = (
            (
                batch_features.get("organizations:mep-rollout-flag", False)
                and batch_features.get("organizations:dynamic-sampling", False)
            )
            or batch_features.get("organizations:performance-use-metrics", False)
            or batch_features.get("organizations:dashboards-mep", False)
        )

        try:
            use_on_demand_metrics, on_demand_metrics_type = self.handle_on_demand(request)
        except ValueError:
            metric_type_values = [e.value for e in MetricSpecType]
            metric_types = ",".join(metric_type_values)
            return Response(
                {"detail": f"On demand metric type must be one of: {metric_types}"}, status=400
            )

        on_demand_metrics_enabled = (
            batch_features.get("organizations:on-demand-metrics-extraction", False)
            or batch_features.get("organizations:on-demand-metrics-extraction-widgets", False)
        ) and use_on_demand_metrics

        dataset = self.get_dataset(request)
        metrics_enhanced = dataset in {metrics_performance, metrics_enhanced_performance}

        sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)
        allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"

        # Force the referrer to "api.auth-token.events" for events requests authorized through a bearer token
        if request.auth:
            referrer = API_TOKEN_REFERRER
        elif referrer not in ALLOWED_EVENTS_REFERRERS:
            referrer = Referrer.API_ORGANIZATION_EVENTS.value

        def _data_fn(scopedDataset, offset, limit, query) -> dict[str, Any]:
            return scopedDataset.query(
                selected_columns=self.get_field_list(organization, request),
                query=query,
                params=params,
                snuba_params=snuba_params,
                equations=self.get_equation_list(organization, request),
                orderby=self.get_orderby(request),
                offset=offset,
                limit=limit,
                referrer=referrer,
                auto_fields=True,
                auto_aggregations=True,
                use_aggregate_conditions=True,
                allow_metric_aggregates=allow_metric_aggregates,
                transform_alias_to_input_format=True,
                # Whether the flag is enabled or not, regardless of the referrer
                has_metrics=use_metrics,
                use_metrics_layer=batch_features.get("organizations:use-metrics-layer", False),
                on_demand_metrics_enabled=on_demand_metrics_enabled,
                on_demand_metrics_type=on_demand_metrics_type,
            )

        def data_fn_factory(scopedDataset):
            """
            This factory closes over query and dataset in order to make an additional request to the errors dataset
            in the case that this request is from a dashboard widget and we're trying to split their discover dataset.

            This should be removed once the discover dataset is completely split in dashboards.
            """
            scoped_query = request.GET.get("query")
            dashboard_widget_id = request.GET.get("dashboardWidgetId", None)

            def fn(offset, limit) -> dict[str, Any]:
                if not (metrics_enhanced and dashboard_widget_id):
                    return _data_fn(scopedDataset, offset, limit, scoped_query)

                try:
                    widget = DashboardWidget.objects.get(id=dashboard_widget_id)
                    does_widget_have_split = widget.discover_widget_split is not None

                    if does_widget_have_split:
                        # This is essentially cached behaviour and we skip the check
                        split_query = scoped_query
                        if widget.discover_widget_split == DashboardWidgetTypes.ERROR_EVENTS:
                            split_dataset = discover
                            split_query = f"({scoped_query}) AND !event.type:transaction"
                        elif widget.discover_widget_split == DashboardWidgetTypes.TRANSACTION_LIKE:
                            # We can't add event.type:transaction for now because of on-demand.
                            split_dataset = scopedDataset
                        else:
                            split_dataset = discover

                        return _data_fn(split_dataset, offset, limit, split_query)

                    try:
                        error_results = _data_fn(
                            discover, offset, limit, f"({scoped_query}) AND !event.type:transaction"
                        )
                        # Widget has not split the discover dataset yet, so we need to check if there are errors etc.
                        has_errors = len(error_results["data"]) > 0
                    except SnubaError:
                        has_errors = False
                        error_results = None

                    original_results = _data_fn(scopedDataset, offset, limit, scoped_query)
                    if original_results.get("data"):
                        dataset_meta = original_results.data.get("meta", {})
                    else:
                        dataset_meta = list(original_results.values())[0].data.get("meta", {})
                    using_metrics = dataset_meta.get("isMetricsData", False) or dataset_meta.get(
                        "isMetricsExtractedData", False
                    )
                    has_other_data = len(original_results["data"]) > 0

                    has_transactions = has_other_data
                    transaction_results = None
                    if has_errors and has_other_data and not using_metrics:
                        # In the case that the original request was not using the metrics dataset, we cannot be certain that other data is solely transactions.
                        sentry_sdk.set_tag("third_split_query", True)
                        transactions_only_query = f"({scoped_query}) AND event.type:transaction"
                        transaction_results = _data_fn(
                            discover, offset, limit, transactions_only_query
                        )
                        has_transactions = len(transaction_results["data"]) > 0

                    decision = self.save_split_decision(widget, has_errors, has_transactions)

                    if decision == DashboardWidgetTypes.DISCOVER:
                        return _data_fn(discover, offset, limit, scoped_query)
                    elif decision == DashboardWidgetTypes.TRANSACTION_LIKE:
                        return original_results
                    elif decision == DashboardWidgetTypes.ERROR_EVENTS and error_results:
                        return error_results
                    else:
                        return original_results
                except Exception as e:
                    # Swallow the exception if it was due to the discover split, and try again one more time.
                    sentry_sdk.capture_exception(e)
                    return _data_fn(scopedDataset, offset, limit, scoped_query)

            return fn

        data_fn = data_fn_factory(dataset)

        with handle_query_errors():
            # Don't include cursor headers if the client won't be using them
            if request.GET.get("noPagination"):
                return Response(
                    self.handle_results_with_meta(
                        request,
                        organization,
                        params["project_id"],
                        data_fn(0, self.get_per_page(request)),
                        standard_meta=True,
                        dataset=dataset,
                    )
                )
            else:
                return self.paginate(
                    request=request,
                    paginator=GenericOffsetPaginator(data_fn=data_fn),
                    on_results=lambda results: self.handle_results_with_meta(
                        request,
                        organization,
                        params["project_id"],
                        results,
                        standard_meta=True,
                        dataset=dataset,
                    ),
                )
