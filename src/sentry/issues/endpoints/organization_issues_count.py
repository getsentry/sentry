from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import start_span

from sentry import features, search
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.group_index import validate_search_filter_permissions
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.issue_search import convert_query_values, parse_search_query
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.snuba import discover
from sentry.types.ratelimit import RateLimit, RateLimitCategory

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', and '14d'"


ISSUES_COUNT_MAX_HITS_LIMIT = 100


@region_silo_endpoint
class OrganizationIssuesCountEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ISSUES
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=10, window=1),
            RateLimitCategory.USER: RateLimit(limit=10, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=1),
        }
    }

    def _count(
        self, request: Request, query, organization, projects, environments, extra_query_kwargs=None
    ):
        with start_span(op="_count"):
            query_kwargs = {"projects": projects}

            query = query.strip()
            if query:
                search_filters = convert_query_values(
                    parse_search_query(query), projects, request.user, environments
                )
                validate_search_filter_permissions(organization, search_filters, request.user)
                query_kwargs["search_filters"] = search_filters

            if extra_query_kwargs is not None:
                assert "environment" not in extra_query_kwargs
                query_kwargs.update(extra_query_kwargs)

            query_kwargs["environments"] = environments if environments else None

            query_kwargs["max_hits"] = ISSUES_COUNT_MAX_HITS_LIMIT

            query_kwargs["actor"] = request.user
        with start_span(op="start_search") as span:
            span.set_data("query_kwargs", query_kwargs)
            result = search.backend.query(**query_kwargs)
            return result.hits

    def get(self, request: Request, organization) -> Response:
        stats_period = request.GET.get("groupStatsPeriod")
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        if stats_period not in (None, "", "24h", "14d", "auto"):
            return Response({"detail": ERR_INVALID_STATS_PERIOD}, status=400)
        environments = self.get_environments(request, organization)

        projects = self.get_projects(request, organization)

        if not projects:
            return Response([])

        is_fetching_replay_data = request.headers.get("X-Sentry-Replay-Request") == "1"

        if (
            len(projects) > 1
            and not features.has("organizations:global-views", organization, actor=request.user)
            and not is_fetching_replay_data
        ):
            return Response(
                {"detail": "You do not have the multi project stream feature enabled"}, status=400
            )

        queries = request.GET.getlist("query")
        response = {}
        for query in queries:
            try:
                count = self._count(
                    request,
                    query,
                    organization,
                    projects,
                    environments,
                    {"count_hits": True, "date_to": end, "date_from": start},
                )
                response[query] = count
            except (ValidationError, discover.InvalidSearchQuery) as exc:
                return Response({"detail": str(exc)}, status=400)

        return Response(response)
