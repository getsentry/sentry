from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventPermission, OrganizationEventsEndpointBase
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba
from sentry.models.group import Group
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class OrganizationGroupIndexStatsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationEventPermission,)
    enforce_rate_limit = True

    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(10, 1),
            RateLimitCategory.USER: RateLimit(10, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(10, 1),
        }
    }

    def get(self, request: Request, organization) -> Response:
        expand = request.GET.getlist("expand", [])
        collapse = request.GET.getlist("collapse", ["base"])
        projects = self.get_projects(request, organization)
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
            elif len(groups) > 25:
                raise ParseError(detail="Too many groups requested.")
            elif not all(request.access.has_project_access(g.project) for g in groups):
                raise PermissionDenied

        environments = self.get_environments(request, organization)
        query_kwargs = build_query_params_from_request(
            request, organization, projects, environments
        )
        context = serialize(
            groups,
            request.user,
            StreamGroupSerializerSnuba(
                environment_ids=[env.id for env in environments],
                collapse=collapse,
                expand=expand,
                search_filters=query_kwargs["search_filters"]
                if "search_filters" in query_kwargs
                else None,
                organization_id=organization.id,
                project_ids=project_ids,
            ),
        )

        response = Response(context)
        return response
