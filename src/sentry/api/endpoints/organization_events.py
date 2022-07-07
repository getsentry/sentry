import logging
from datetime import datetime

import sentry_sdk
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.deprecation import deprecated
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import InvalidParams
from sentry.apidocs import constants as api_constants
from sentry.apidocs.parameters import GLOBAL_PARAMS, VISIBILITY_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.ratelimits.config import DEFAULT_RATE_LIMIT_CONFIG, RateLimitConfig
from sentry.search.events.fields import is_function
from sentry.snuba import discover, metrics_enhanced_performance
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

METRICS_ENHANCED_REFERRERS = {
    "api.performance.landing-table",
}

ALLOWED_EVENTS_REFERRERS = {
    "api.organization-events",
    "api.organization-events-v2",
    "api.dashboards.tablewidget",
    "api.dashboards.bignumberwidget",
    "api.discover.transactions-list",
    "api.discover.query-table",
    "api.performance.vitals-cards",
    "api.performance.landing-table",
    "api.performance.transaction-summary",
    "api.performance.transaction-spans",
    "api.performance.status-breakdown",
    "api.performance.vital-detail",
    "api.performance.durationpercentilechart",
    "api.performance.tag-page",
    "api.trace-view.span-detail",
    "api.trace-view.errors-view",
    "api.trace-view.hover-card",
}

ALLOWED_EVENTS_GEO_REFERRERS = {
    "api.organization-events-geo",
    "api.dashboards.worldmapwidget",
}

API_TOKEN_REFERRER = "api.auth-token.events"

RATE_LIMIT = 50
RATE_LIMIT_WINDOW = 1
CONCURRENT_RATE_LIMIT = 50


class OrganizationEventsV2Endpoint(OrganizationEventsV2EndpointBase):
    """Deprecated in favour of OrganizationEventsEndpoint"""

    enforce_rate_limit = True

    def rate_limits(request: Request, organization_slug=None, *args, **kwargs) -> RateLimitConfig:
        try:
            organization = Organization.objects.get_from_cache(slug=organization_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist
        # Check for feature flag to enforce rate limit otherwise use default rate limit
        if features.has(
            "organizations:discover-events-rate-limit", organization, actor=request.user
        ):
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
        return DEFAULT_RATE_LIMIT_CONFIG

    @deprecated(
        datetime.fromisoformat("2022-07-21T00:00:00+00:00:00"),
        suggested_api="api/0/organizations/{organization_slug}/events/",
    )
    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])
        except InvalidParams as err:
            raise ParseError(err)

        referrer = request.GET.get("referrer")
        use_metrics = features.has(
            "organizations:performance-use-metrics", organization=organization, actor=request.user
        ) or features.has(
            "organizations:dashboards-mep", organization=organization, actor=request.user
        )
        performance_dry_run_mep = features.has(
            "organizations:performance-dry-run-mep", organization=organization, actor=request.user
        )

        # This param will be deprecated in favour of dataset
        if "metricsEnhanced" in request.GET:
            metrics_enhanced = request.GET.get("metricsEnhanced") == "1" and use_metrics
            dataset = discover if not metrics_enhanced else metrics_enhanced_performance
        else:
            dataset = self.get_dataset(request) if use_metrics else discover
            metrics_enhanced = dataset != discover

        sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)
        allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"

        referrer = (
            referrer if referrer in ALLOWED_EVENTS_REFERRERS else "api.organization-events-v2"
        )

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
                    )
                )
            else:
                return self.paginate(
                    request=request,
                    paginator=GenericOffsetPaginator(data_fn=data_fn),
                    on_results=lambda results: self.handle_results_with_meta(
                        request, organization, params["project_id"], results
                    ),
                )


@extend_schema(tags=["Discover"])
class OrganizationEventsEndpoint(OrganizationEventsV2EndpointBase):
    public = {"GET"}

    enforce_rate_limit = True

    def rate_limits(request: Request, organization_slug=None, *args, **kwargs) -> RateLimitConfig:
        try:
            organization = Organization.objects.get_from_cache(slug=organization_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist
        # Check for feature flag to enforce rate limit otherwise use default rate limit
        if features.has(
            "organizations:discover-events-rate-limit", organization, actor=request.user
        ):
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
        return DEFAULT_RATE_LIMIT_CONFIG

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
        use_metrics = features.has(
            "organizations:performance-use-metrics", organization=organization, actor=request.user
        ) or features.has(
            "organizations:dashboards-mep", organization=organization, actor=request.user
        )
        performance_dry_run_mep = features.has(
            "organizations:performance-dry-run-mep", organization=organization, actor=request.user
        )

        # This param will be deprecated in favour of dataset
        if "metricsEnhanced" in request.GET:
            metrics_enhanced = request.GET.get("metricsEnhanced") == "1" and use_metrics
            dataset = discover if not metrics_enhanced else metrics_enhanced_performance
        else:
            dataset = self.get_dataset(request) if use_metrics else discover
            metrics_enhanced = dataset != discover

        sentry_sdk.set_tag("performance.metrics_enhanced", metrics_enhanced)
        allow_metric_aggregates = request.GET.get("preventMetricAggregates") != "1"
        # Force the referrer to "api.auth-token.events" for events requests authorized through a bearer token
        if request.auth:
            referrer = API_TOKEN_REFERRER
        elif referrer not in ALLOWED_EVENTS_REFERRERS:
            referrer = "api.organization-events"

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
            referrer if referrer in ALLOWED_EVENTS_GEO_REFERRERS else "api.organization-events-geo"
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
