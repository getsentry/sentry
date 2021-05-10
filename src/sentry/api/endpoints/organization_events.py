import logging

from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.search.events.fields import is_function
from sentry.snuba import discover

logger = logging.getLogger(__name__)

ALLOWED_EVENTS_V2_REFERRERS = {
    "api.organization-events-v2",
    "api.dashboards.tablewidget",
    "api.dashboards.bignumberwidget",
    "api.discover.transactions-list",
    "api.discover.query-table",
    "api.performance.vitals-cards",
    "api.performance.landing-table",
    "api.performance.transaction-summary",
    "api.performance.status-breakdown",
    "api.performance.vital-detail",
    "api.performance.durationpercentilechart",
    "api.trace-view.span-detail",
    "api.trace-view.errors-view",
    "api.trace-view.hover-card",
}

ALLOWED_EVENTS_GEO_REFERRERS = {
    "api.organization-events-geo",
    "api.dashboards.worldmapwidget",
}


class OrganizationEventsV2Endpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        referrer = request.GET.get("referrer")
        referrer = (
            referrer if referrer in ALLOWED_EVENTS_V2_REFERRERS else "api.organization-events-v2"
        )

        def data_fn(offset, limit):
            return discover.query(
                selected_columns=request.GET.getlist("field")[:],
                query=request.GET.get("query"),
                params=params,
                orderby=self.get_orderby(request),
                offset=offset,
                limit=limit,
                referrer=referrer,
                auto_fields=True,
                auto_aggregations=True,
                use_aggregate_conditions=True,
            )

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


class OrganizationEventsGeoEndpoint(OrganizationEventsV2EndpointBase):
    def has_feature(self, request, organization):
        return features.has("organizations:dashboards-basic", organization, actor=request.user)

    def get(self, request, organization):
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
