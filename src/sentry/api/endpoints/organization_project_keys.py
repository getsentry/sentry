from django.db.models import F
from drf_spectacular.utils import OpenApiExample, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project_key import ProjectKeySerializerResponse
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.project_examples import KEY_NO_RATE_LIMIT, KEY_RATE_LIMIT
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.models.team import Team
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@extend_schema(tags=["Organizations"])
@region_silo_endpoint
class OrganizationProjectKeysEndpoint(OrganizationEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=40, window=1),
                RateLimitCategory.USER: RateLimit(limit=40, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=40, window=1),
            },
        },
    )

    @extend_schema(
        operation_id="List an Organization's Client Keys",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            CursorQueryParam,
            inline_serializer(
                name="OrganizationProjectKeysQueryParams",
                fields={
                    "team": serializers.CharField(
                        help_text="Filter keys by team slug or ID. If provided, only keys for projects belonging to this team will be returned.",
                        required=False,
                    ),
                    "status": serializers.ChoiceField(
                        choices=["active", "inactive"],
                        help_text="Filter keys by status. Options are 'active' or 'inactive'.",
                        required=False,
                    ),
                },
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationClientKeysResponse", list[ProjectKeySerializerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "List client keys for all projects in an organization",
                value=[
                    KEY_RATE_LIMIT,
                    KEY_NO_RATE_LIMIT,
                ],
                status_codes=["200"],
                response_only=True,
            ),
        ],
    )
    def get(self, request: Request, organization) -> Response:
        """
        Return a list of client keys (DSNs) for all projects in an organization.

        This paginated endpoint lists client keys across all projects in an organization. Each key includes the project ID
        to identify which project it belongs to.

        Query Parameters:
        - team: Filter by team slug or ID to get keys only for that team's projects
        - status: Filter by 'active' or 'inactive' to get keys with specific status
        """
        projects = self.get_projects(request, organization)

        project_id_set: set[int] = {p.id for p in projects}

        team_param = request.GET.get("team")
        if team_param:
            try:
                if team_param.isdigit():
                    team = Team.objects.get(id=team_param, organization=organization)
                else:
                    team = Team.objects.get(slug=team_param, organization=organization)
            except Team.DoesNotExist:
                raise ResourceDoesNotExist(detail="Team not found")

            project_id_set = set(
                Project.objects.filter(id__in=project_id_set, teams=team).values_list(
                    "id", flat=True
                )
            )

        queryset = ProjectKey.objects.for_request(request).filter(
            project_id__in=project_id_set, roles=F("roles").bitor(ProjectKey.roles.store)
        )

        status = request.GET.get("status")
        if status == "active":
            queryset = queryset.filter(status=ProjectKeyStatus.ACTIVE)
        elif status == "inactive":
            queryset = queryset.filter(status=ProjectKeyStatus.INACTIVE)
        elif status:
            queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-id",
            default_per_page=10,
            on_results=lambda x: serialize(x, request.user, request=request),
        )
