import logging

import sentry_sdk
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import InvalidParams
from sentry.apidocs import constants as api_constants
from sentry.apidocs.parameters import GLOBAL_PARAMS, VISIBILITY_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.search.events.fields import is_function
from sentry.snuba import discover, metrics_enhanced_performance, metrics_performance
from sentry.snuba.referrer import Referrer
from sentry.types.ratelimit import RateLimit, RateLimitCategory

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
    Referrer.API_REPLAY_DETAILS_PAGE.value,
    Referrer.API_TRACE_VIEW_SPAN_DETAIL.value,
    Referrer.API_TRACE_VIEW_ERRORS_VIEW.value,
    Referrer.API_TRACE_VIEW_HOVER_CARD.value,
    Referrer.API_ISSUES_ISSUE_EVENTS.value,
}

ALLOWED_EVENTS_GEO_REFERRERS = {
    Referrer.API_ORGANIZATION_EVENTS_GEO.value,
    Referrer.API_DASHBOARDS_WORLDMAPWIDGET.value,
}

API_TOKEN_REFERRER = Referrer.API_AUTH_TOKEN_EVENTS.value

RATE_LIMIT = 15
RATE_LIMIT_WINDOW = 1
CONCURRENT_RATE_LIMIT = 10

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
    public = {"GET"}

    enforce_rate_limit = True

    def rate_limits(*args, **kwargs) -> RateLimitConfig:
        return rate_limit_events(*args, **kwargs)

    @extend_schema(
        operation_id="Query Discover Events in Table Format",
        parameters=[
            GLOBAL_PARAMS.END,
            GLOBAL_PARAMS.ENVIRONMENT,
            GLOBAL_PARAMS.ORG_SLUG,
            GLOBAL_PARAMS.PROJECT,
            GLOBAL_PARAMS.START,
            GLOBAL_PARAMS.STATS_PERIOD,
            VISIBILITY_PARAMS.FIELD,
            VISIBILITY_PARAMS.PER_PAGE,
            VISIBILITY_PARAMS.QUERY,
            VISIBILITY_PARAMS.SORT,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsResponseDict", discover.EventsResponse
            ),
            400: OpenApiResponse(description="Invalid Query"),
            404: api_constants.RESPONSE_NOTFOUND,
        },
        examples=[
            OpenApiExample(
                "Success",
                value={
                    "data": [
                        {
                            "count_if(transaction.duration,greater,300)": 5,
                            "count()": 10,
                            "equation|count_if(transaction.duration,greater,300) / count() * 100": 50,
                            "transaction": "foo",
                        },
                        {
                            "count_if(transaction.duration,greater,300)": 3,
                            "count()": 20,
                            "equation|count_if(transaction.duration,greater,300) / count() * 100": 15,
                            "transaction": "bar",
                        },
                        {
                            "count_if(transaction.duration,greater,300)": 8,
                            "count()": 40,
                            "equation|count_if(transaction.duration,greater,300) / count() * 100": 20,
                            "transaction": "baz",
                        },
                    ],
                    "meta": {
                        "fields": {
                            "count_if(transaction.duration,greater,300)": "integer",
                            "count()": "integer",
                            "equation|count_if(transaction.duration,greater,300) / count() * 100": "number",
                            "transaction": "string",
                        },
                    },
                },
            )
        ],
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
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])
        except InvalidParams as err:
            raise ParseError(err)

        referrer = request.GET.get("referrer")
        use_metrics = (
            (
                features.has(
                    "organizations:mep-rollout-flag", organization=organization, actor=request.user
                )
                and features.has(
                    "organizations:server-side-sampling",
                    organization=organization,
                    actor=request.user,
                )
            )
            or features.has(
                "organizations:performance-use-metrics",
                organization=organization,
                actor=request.user,
            )
            or features.has(
                "organizations:dashboards-mep", organization=organization, actor=request.user
            )
        )

        use_profiles = features.has(
            "organizations:profiling",
            organization=organization,
            actor=request.user,
        )

        performance_dry_run_mep = features.has(
            "organizations:performance-dry-run-mep", organization=organization, actor=request.user
        )
        use_metrics_layer = features.has(
            "organizations:use-metrics-layer", organization=organization, actor=request.user
        )

        use_custom_dataset = use_metrics or use_profiles
        dataset = self.get_dataset(request) if use_custom_dataset else discover
        metrics_enhanced = dataset in {metrics_performance, metrics_enhanced_performance}

        sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)
        allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"
        # Force the referrer to "api.auth-token.events" for events requests authorized through a bearer token
        if request.auth:
            referrer = API_TOKEN_REFERRER
        elif referrer not in ALLOWED_EVENTS_REFERRERS:
            referrer = Referrer.API_ORGANIZATION_EVENTS.value

        def data_fn(offset, limit):
            query_details = {
                "selected_columns": self.get_field_list(organization, request),
                "query": request.GET.get("query"),
                "params": params,
                "equations": self.get_equation_list(organization, request),
                "orderby": self.get_orderby(request),
                "offset": offset,
                "limit": limit,
                "referrer": referrer,
                "auto_fields": True,
                "auto_aggregations": True,
                "use_aggregate_conditions": True,
                "allow_metric_aggregates": allow_metric_aggregates,
                "transform_alias_to_input_format": True,
                # Whether the flag is enabled or not, regardless of the referrer
                "has_metrics": use_metrics,
                "use_metrics_layer": use_metrics_layer,
            }
            if not metrics_enhanced and performance_dry_run_mep:
                sentry_sdk.set_tag("query.mep_compatible", False)
                metrics_enhanced_performance.query(dry_run=True, **query_details)
            return dataset.query(**query_details)

        with self.handle_query_errors():
            # Don't include cursor headers if the client won't be using them
            if request.GET.get("noPagination"):
                return Response(
                    self.handle_results_with_meta(
                        request,
                        organization,
                        params["project_id"],
                        data_fn(0, self.get_per_page(request)),
                        standard_meta=True,
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
                    ),
                )


@region_silo_endpoint
class OrganizationEventsGeoEndpoint(OrganizationEventsV2EndpointBase):
    def has_feature(self, request: Request, organization):
        return features.has("organizations:dashboards-basic", organization, actor=request.user)

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(request, organization):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        maybe_aggregate = request.GET.get("field")

        if not maybe_aggregate:
            raise ParseError(detail="No column selected")

        if not is_function(maybe_aggregate):
            raise ParseError(detail="Functions may only be given")

        referrer = request.GET.get("referrer")
        referrer = (
            referrer
            if referrer in ALLOWED_EVENTS_GEO_REFERRERS
            else Referrer.API_ORGANIZATION_EVENTS_GEO.value
        )

        def data_fn(offset, limit):
            return discover.query(
                selected_columns=["geo.country_code", maybe_aggregate],
                query=f"{request.GET.get('query', '')} has:geo.country_code",
                params=params,
                offset=offset,
                limit=limit,
                referrer=referrer,
                use_aggregate_conditions=True,
                orderby=self.get_orderby(request) or maybe_aggregate,
            )

        with self.handle_query_errors():
            # We don't need pagination, so we don't include the cursor headers
            return Response(
                self.handle_results_with_meta(
                    request,
                    organization,
                    params["project_id"],
                    # Expect Discover query output to be at most 251 rows, which corresponds
                    # to the number of possible two-letter country codes as defined in ISO 3166-1 alpha-2.
                    #
                    # There are 250 country codes from sentry/static/app/data/countryCodesMap.tsx
                    # plus events with no assigned country code.
                    data_fn(0, self.get_per_page(request, default_per_page=251, max_per_page=251)),
                )
            )
