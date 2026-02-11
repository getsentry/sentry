import time
from typing import TypedDict

from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint, TeamPermission
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.helpers.default_inbound_filters import set_default_inbound_filters
from sentry.api.helpers.default_symbol_sources import set_default_symbol_sources
from sentry.api.helpers.environments import get_environment_id
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import ProjectSummarySerializer, serialize
from sentry.api.serializers.models.project import OrganizationProjectResponse
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.examples.team_examples import TeamExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import PROJECT_SLUG_MAX_LENGTH, RESERVED_PROJECT_SLUGS, ObjectStatus
from sentry.issue_detection.detectors.disable_detectors import set_default_disabled_detectors
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.seer.similarity.utils import (
    project_is_seer_eligible,
    set_default_project_auto_open_prs,
    set_default_project_autofix_automation_tuning,
    set_default_project_seer_scanner_automation,
)
from sentry.signals import project_created
from sentry.utils.platform_categories import CONSOLES
from sentry.utils.snowflake import MaxSnowflakeRetryError

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', '14d', and '30d'"


def apply_default_project_settings(organization: Organization, project: Project) -> None:
    if project.platform and project.platform.startswith("javascript"):
        set_default_inbound_filters(project, organization)

    set_default_disabled_detectors(project)

    set_default_symbol_sources(project, organization)

    # Create project option to turn on ML similarity feature for new EA projects
    if project_is_seer_eligible(project):
        project.update_option("sentry:similarity_backfill_completed", int(time.time()))

    set_default_project_autofix_automation_tuning(organization, project)
    set_default_project_seer_scanner_automation(organization, project)
    set_default_project_auto_open_prs(organization, project)


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
        if not Project.is_valid_platform(value):
            raise serializers.ValidationError("Invalid platform")

        if value in CONSOLES:
            organization = self.context.get("organization")
            assert organization is not None
            enabled_console_platforms = organization.get_option(
                "sentry:enabled_console_platforms", []
            )

            if value not in enabled_console_platforms:
                raise serializers.ValidationError(
                    f"Console platform '{value}' is not enabled for this organization"
                )

        return value

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
    request: Request
    organization: Organization
    target_object: int


@extend_schema(tags=["Teams"])
@region_silo_endpoint
class TeamProjectsEndpoint(TeamEndpoint):
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
                    environment_id=get_environment_id(request, team.organization.id),
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
            201: ProjectSummarySerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: OpenApiResponse(description="Team not found."),
            409: OpenApiResponse(description="A project with this slug already exists."),
        },
        examples=ProjectExamples.CREATE_PROJECT,
        description="""Create a new project bound to a team.

        Note: If your organization has disabled member project creation, the `org:write` or `team:admin` scope is required.
        """,
    )
    def post(self, request: Request, team: Team) -> Response:
        from sentry.core.endpoints.organization_projects_experiment import (
            DISABLED_FEATURE_ERROR_STRING,
        )

        serializer = ProjectPostSerializer(
            data=request.data, context={"organization": team.organization}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if team.organization.flags.disable_member_project_creation and not (
            request.access.has_scope("org:write")
        ):
            # Only allow project creation if the user is an admin of the team
            if not request.access.has_team_scope(team, "team:admin"):
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

            apply_default_project_settings(team.organization, project)

            common_audit_data: AuditData = {
                "request": request,
                "organization": team.organization,
                "target_object": project.id,
            }

            origin = request.data.get("origin")
            if origin:
                self.create_audit_entry(
                    **common_audit_data,
                    event=audit_log.get_event_id("PROJECT_ADD_WITH_ORIGIN"),
                    data={
                        **project.get_audit_log_data(),
                        "origin": origin,
                    },
                )
            else:
                self.create_audit_entry(
                    **common_audit_data,
                    event=audit_log.get_event_id("PROJECT_ADD"),
                    data={**project.get_audit_log_data()},
                )

            project_created.send_robust(
                project=project,
                user=request.user,
                default_rules=result.get("default_rules", True),
                origin=origin,
                sender=self,
            )

        return Response(
            serialize(project, request.user, ProjectSummarySerializer(collapse=["unusedFeatures"])),
            status=201,
        )
