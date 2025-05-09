from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.group_index import build_query_params_from_request, calculate_stats_period
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba
from sentry.api.utils import get_date_range_from_stats_period
from sentry.exceptions import InvalidParams
from sentry.issues.endpoints.organization_group_index import ERR_INVALID_STATS_PERIOD
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class OrganizationGroupIndexStatsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationEventPermission,)
    enforce_rate_limit = True
    owner = ApiOwner.ISSUES

    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=10, window=1),
            RateLimitCategory.USER: RateLimit(limit=10, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=1),
        }
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get the stats on an Organization's Issues
        `````````````````````````````
        Return a list of issues (groups) with the requested stats.  All parameters are
        supplied as query string parameters.

        :qparam list groups: A list of group ids
        :qparam list expand: an optional list of strings to opt in to additional data. Supports `inbox`
        :qparam list collapse: an optional list of strings to opt out of certain pieces of data. Supports `stats`, `lifetime`, `filtered`, and `base`

        The ``groupStatsPeriod`` parameter can be used to select the timeline
        stats which should be present. Possible values are: '' (disable),
        '24h', '14d'

        The ``statsPeriod`` parameter can be used to select a date window starting
        from now. Ex. ``14d``.

        The ``start`` and ``end`` parameters can be used to select an absolute
        date period to fetch issues from.

        :qparam string statsPeriod: an optional stat period (can be one of
                                    ``"24h"``, ``"14d"``, and ``""``).
        :qparam string groupStatsPeriod: an optional stat period (can be one of
                                    ``"24h"``, ``"14d"``, and ``""``).
        :qparam string start:       Beginning date. You must also provide ``end``.
        :qparam string end:         End date. You must also provide ``start``.
        """

        stats_period = request.GET.get("groupStatsPeriod")
        try:
            start, end = get_date_range_from_stats_period(request.GET)
        except InvalidParams as e:
            raise ParseError(detail=str(e))

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
        query_kwargs = build_query_params_from_request(
            request, organization, projects, environments
        )
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
