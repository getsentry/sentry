from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.issues.progress import get_group_progress_states
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@cell_silo_endpoint
class OrganizationGroupIndexProgressEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationEventPermission,)
    enforce_rate_limit = True
    owner = ApiOwner.ISSUES

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
        operation_id="Get Progress for a List of Issues",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="groups",
                location="query",
                required=True,
                type=int,
                many=True,
                description="One or more group IDs to retrieve progress for. Maximum 100.",
            ),
        ],
        responses={
            200: dict[str, dict[str, dict[str, str]]],
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:issue-stream-progress-ui", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        try:
            group_ids = set(map(int, request.GET.getlist("groups")))
        except ValueError:
            raise ParseError(detail="Group ids must be integers")

        if not group_ids:
            raise ParseError(
                detail="You should include `groups` with your request. (i.e. groups=1,2,3)"
            )

        if len(group_ids) > 100:
            raise ParseError(detail="Too many groups requested.")

        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]

        groups = list(
            Group.objects.filter(id__in=group_ids, project_id__in=project_ids).select_related(
                "project"
            )
        )

        if not groups:
            raise ParseError(detail="No matching groups found")

        if not all(request.access.has_project_access(g.project) for g in groups):
            raise PermissionDenied

        found_group_ids = [g.id for g in groups]

        progress_by_group = get_group_progress_states(found_group_ids)

        return Response(
            {"results": {str(gid): {"progress": progress_by_group[gid]} for gid in found_group_ids}}
        )
