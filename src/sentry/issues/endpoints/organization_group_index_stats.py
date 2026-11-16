from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import DEFAULT_DURATION_BUDGET, cell_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.group_index import build_query_params_from_request, calculate_stats_period
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import (
    StreamGroupSerializerSnuba,
    StreamGroupSerializerSnubaResponse,
)
from sentry.api.utils import get_date_range_from_stats_period, handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, IssueParams, OrganizationParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.issues.endpoints.organization_group_index import ERR_INVALID_STATS_PERIOD
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class OrganizationGroupIndexStatsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
    }
    permission_classes = (OrganizationEventPermission,)
    enforce_rate_limit = True
    owner = ApiOwner.ISSUES
    max_acceptable_duration = DEFAULT_DURATION_BUDGET

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=10, window=1),
                RateLimitCategory.USER: RateLimit(limit=10, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=1),
            }
        }
    )

    @extend_schema(
        operation_id="listOrganizationIssueStats",
        summary="List Stats for an Organization's Issues",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.STATS_GROUPS,
            GlobalParams.ENVIRONMENT,
            OrganizationParams.PROJECT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.STATS_PERIOD_START,
            GlobalParams.STATS_PERIOD_END,
            GlobalParams.START,
            GlobalParams.END,
            IssueParams.GROUP_STATS_PERIOD,
            IssueParams.DEFAULT_QUERY,
            IssueParams.GROUP_INDEX_EXPAND,
            IssueParams.STATS_COLLAPSE,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationGroupIndexStatsGetResponse", list[StreamGroupSerializerSnubaResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[StreamGroupSerializerSnubaResponse]] | Response[DetailResponse]:
        """
        Return counts, first and last seen, and stats for the requested issues. Use it to
        fill in stats for an issue list fetched with `collapse=stats`. The `query` filters
        the `filtered` counts.

        For an absolute date range, send `start` and `end` together: each one requires the
        other.
        """
        stats_period = request.GET.get("groupStatsPeriod")
        start, end = get_date_range_from_stats_period(request.GET)

        expand = request.GET.getlist("expand", [])
        collapse = request.GET.getlist("collapse", ["base"])
        projects = self.get_projects(request, organization)
        if not projects:
            raise ParseError(
                detail="Either the user has not access to any projects or you need to "
                + "include `projects` with your request. (i.e. projects=1,2,3)"
            )
        project_ids = [p.id for p in projects]

        try:
            group_ids = set(map(int, request.GET.getlist("groups")))
        except ValueError:
            raise ParseError(detail="Group ids must be integers")

        if not group_ids:
            raise ParseError(
                detail="You should include `groups` with your request. (i.e. groups=1,2,3)"
            )

        else:
            groups = list(
                Group.objects.filter(id__in=group_ids, project_id__in=project_ids).select_related(
                    "project"
                )
            )
            if not groups:
                raise ParseError(detail="No matching groups found")
            elif len(groups) > 100:
                raise ParseError(detail="Too many groups requested.")
            elif not all(request.access.has_project_access(g.project) for g in groups):
                raise PermissionDenied

        if stats_period not in (None, "", "24h", "14d", "auto"):
            raise ParseError(detail=ERR_INVALID_STATS_PERIOD)
        stats_period, stats_period_start, stats_period_end = calculate_stats_period(
            stats_period, start, end
        )

        environments = self.get_environments(request, organization)
        try:
            query_kwargs = build_query_params_from_request(
                request, organization, projects, environments
            )
        except ValidationError:
            return Response({"detail": "Invalid request parameters."}, status=400)
        with handle_query_errors():
            context = serialize(
                groups,
                request.user,
                StreamGroupSerializerSnuba(
                    environment_ids=[env.id for env in environments],
                    stats_period=stats_period,
                    stats_period_start=stats_period_start,
                    stats_period_end=stats_period_end,
                    collapse=collapse,
                    expand=expand,
                    start=start,
                    end=end,
                    search_filters=(
                        query_kwargs["search_filters"] if "search_filters" in query_kwargs else None
                    ),
                    organization_id=organization.id,
                    project_ids=project_ids,
                ),
                request=request,
            )

        response = Response(context)
        return response
