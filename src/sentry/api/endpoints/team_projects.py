import time
from typing import TypedDict

from django.db import IntegrityError, router, transaction
from django.http import HttpRequest
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint, TeamPermission
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.helpers.default_inbound_filters import set_default_inbound_filters
from sentry.api.helpers.default_symbol_sources import set_default_symbol_sources
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import ProjectSummarySerializer, serialize
from sentry.api.serializers.models.project import OrganizationProjectResponse, ProjectSerializer
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.examples.team_examples import TeamExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import PROJECT_SLUG_MAX_LENGTH, RESERVED_PROJECT_SLUGS, ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.seer.similarity.utils import project_is_seer_eligible
from sentry.signals import project_created
from sentry.utils.snowflake import MaxSnowflakeRetryError

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', '14d', and '30d'"


class ProjectPostSerializer(serializers.Serializer):
    name = serializers.CharField(
        help_text="The name for the project.", max_length=50, required=True
    )
    slug = SentrySerializerSlugField(
        help_text="""Uniquely identifies a project and is used for the interface.
        If not provided, it is automatically generated from the name.""",
        max_length=PROJECT_SLUG_MAX_LENGTH,
        required=False,
        allow_null=True,
    )
    platform = serializers.CharField(
        help_text="The platform for the project.", required=False, allow_blank=True, allow_null=True
    )
    default_rules = serializers.BooleanField(
        help_text="""
Defaults to true where the behavior is to alert the user on every new
issue. Setting this to false will turn this off and the user must create
their own alerts to be notified of new issues.
        """,
        required=False,
        initial=True,
    )

    def validate_platform(self, value):
        if Project.is_valid_platform(value):
            return value
        raise serializers.ValidationError("Invalid platform")

    def validate_name(self, value: str) -> str:
        if value in RESERVED_PROJECT_SLUGS:
            raise serializers.ValidationError(f'The name "{value}" is reserved and not allowed.')
        return value


# While currently the UI suggests teams are a parent of a project, in reality
# the project is the core component, and which team it is on is simply an
# attribute. Because you can already change the team of a project via mutating
# it, and because Sentry intends to remove teams as a hierarchy item, we
# allow you to view a teams projects, as well as create a new project as long
# as you are a member of that team and have project scoped permissions.


class TeamProjectPermission(TeamPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:admin"],
    }


class AuditData(TypedDict):
    request: HttpRequest
    organization: Organization
    target_object: int


@extend_schema(tags=["Teams"])
@region_silo_endpoint
class TeamProjectsEndpoint(TeamEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (TeamProjectPermission,)
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="List a Team's Projects",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.TEAM_ID_OR_SLUG,
            CursorQueryParam,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListTeamProjectResponse", list[OrganizationProjectResponse]
            ),
            403: RESPONSE_FORBIDDEN,
            404: OpenApiResponse(description="Team not found."),
        },
        examples=TeamExamples.LIST_TEAM_PROJECTS,
    )
    def get(self, request: Request, team) -> Response:
        """
        Return a list of projects bound to a team.
        """
        if request.auth and hasattr(request.auth, "project"):
            queryset = Project.objects.filter(id=request.auth.project.id)
        else:
            queryset = Project.objects.filter(teams=team, status=ObjectStatus.ACTIVE)

        stats_period = request.GET.get("statsPeriod")
        if stats_period not in (None, "", "24h", "14d", "30d"):
            return Response(
                {"error": {"params": {"stats_period": {"message": ERR_INVALID_STATS_PERIOD}}}},
                status=400,
            )
        elif not stats_period:
            # disable stats
            stats_period = None

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="slug",
            on_results=lambda x: serialize(
                x,
                request.user,
                ProjectSummarySerializer(
                    environment_id=self._get_environment_id_from_request(
                        request, team.organization.id
                    ),
                    stats_period=stats_period,
                ),
            ),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        # Ensure POST is in the projects tab
        tags=["Projects"],
        operation_id="Create a New Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.TEAM_ID_OR_SLUG,
        ],
        request=ProjectPostSerializer,
        responses={
            201: ProjectSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: OpenApiResponse(description="Team not found."),
            409: OpenApiResponse(description="A project with this slug already exists."),
        },
        examples=ProjectExamples.CREATE_PROJECT,
    )
    def post(self, request: Request, team: Team) -> Response:
        """
        Create a new project bound to a team.
        """
        from sentry.api.endpoints.organization_projects_experiment import (
            DISABLED_FEATURE_ERROR_STRING,
        )

        serializer = ProjectPostSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if (
            team.organization.flags.disable_member_project_creation
            and not request.access.has_scope("org:write")
        ):
            return Response({"detail": DISABLED_FEATURE_ERROR_STRING}, status=403)

        result = serializer.validated_data
        with transaction.atomic(router.db_for_write(Project)):
            try:
                with transaction.atomic(router.db_for_write(Project)):
                    project = Project.objects.create(
                        name=result["name"],
                        slug=result.get("slug"),
                        organization=team.organization,
                        platform=result.get("platform"),
                    )
            except (IntegrityError, MaxSnowflakeRetryError):
                return Response({"detail": "A project with this slug already exists."}, status=409)
            else:
                project.add_team(team)

            # XXX: create sample event?

            # Turns on some inbound filters by default for new Javascript platform projects
            if project.platform and project.platform.startswith("javascript"):
                set_default_inbound_filters(project, team.organization)

            set_default_symbol_sources(project)

            common_audit_data: AuditData = {
                "request": request,
                "organization": team.organization,
                "target_object": project.id,
            }

            if request.data.get("origin"):
                self.create_audit_entry(
                    **common_audit_data,
                    event=audit_log.get_event_id("PROJECT_ADD_WITH_ORIGIN"),
                    data={
                        **project.get_audit_log_data(),
                        "origin": request.data.get("origin"),
                    },
                )
            else:
                self.create_audit_entry(
                    **common_audit_data,
                    event=audit_log.get_event_id("PROJECT_ADD"),
                    data={**project.get_audit_log_data()},
                )

            project_created.send(
                project=project,
                user=request.user,
                default_rules=result.get("default_rules", True),
                sender=self,
            )

            # Create project option to turn on ML similarity feature for new EA projects
            if project_is_seer_eligible(project):
                project.update_option("sentry:similarity_backfill_completed", int(time.time()))

        return Response(serialize(project, request.user), status=201)
