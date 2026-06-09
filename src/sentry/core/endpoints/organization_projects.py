import logging
import random
import string
from email.headerregistry import Address
from typing import Any, TypedDict, TypeIs

from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.db.models.query import QuerySet
from django.utils.text import slugify
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotAuthenticated, ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ValidationError

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ConflictError, ResourceDoesNotExist
from sentry.api.helpers.environments import get_environment_id
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import StaffPermissionMixin
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import (
    OrganizationProjectResponse,
    ProjectSummarySerializer,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import (
    CursorQueryParam,
    GlobalParams,
    OrganizationParams,
    VisibilityParams,
)
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.core.endpoints.team_projects import (
    AuditData,
    ProjectPostSerializer,
    apply_default_project_settings,
)
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.search.utils import tokenize_query
from sentry.signals import project_created, team_created
from sentry.snuba import discover, metrics_enhanced_performance, metrics_performance
from sentry.users.models.user import User
from sentry.utils.snowflake import MaxSnowflakeRetryError

ERR_INVALID_STATS_PERIOD = (
    "Invalid stats_period. Valid choices are '', '1h', '24h', '7d', '14d', '30d', and '90d'"
)


class _LegacyParamErrorResponse(TypedDict):
    # Legacy nested error envelope used by this endpoint's stats_period / id
    # validation; kept as-is for wire compatibility.
    error: dict[str, dict[str, dict[str, str]]]


DATASETS = {
    "": discover,  # in case they pass an empty query string fall back on default
    "discover": discover,
    "metricsEnhanced": metrics_enhanced_performance,
    "metrics": metrics_performance,
}

CONFLICTING_TEAM_SLUG_ERROR = "A team with this slug already exists."
MISSING_PERMISSION_ERROR_STRING = "You do not have permission to join a new team as a Team Admin."
DISABLED_FEATURE_ERROR_STRING = "Your organization has disabled this feature for members."


def get_dataset(dataset_label: str) -> Any:
    if dataset_label not in DATASETS:
        raise ParseError(detail=f"dataset must be one of: {', '.join(DATASETS.keys())}")
    return DATASETS[dataset_label]


def _generate_suffix() -> str:
    letters = string.ascii_lowercase
    return "".join(random.choice(letters) for _ in range(3))


def fetch_slugifed_email_username(email: str) -> str:
    return slugify(Address(addr_spec=email).username)


class OrganizationProjectsPermission(StaffPermissionMixin, OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        # Intentionally lowered: org members can create projects when
        # allowMemberProjectCreation is enabled on the org.
        "POST": ["project:read", "project:write", "project:admin"],
    }


@extend_schema(tags=["Organizations"])
@cell_silo_endpoint
class OrganizationProjectsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationProjectsPermission,)
    owner = ApiOwner.FOUNDATIONS
    logger = logging.getLogger("team-project.create")

    @extend_schema(
        operation_id="List an Organization's Projects",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            CursorQueryParam,
            VisibilityParams.PER_PAGE,
            OrganizationParams.PROJECT_QUERY,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationProjectResponseDict", list[OrganizationProjectResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationExamples.LIST_PROJECTS,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> (
        Response[list[OrganizationProjectResponse]]
        | Response[DetailResponse]
        | Response[_LegacyParamErrorResponse]
    ):
        """
        Return a list of projects bound to a organization.
        """
        stats_period = request.GET.get("statsPeriod")
        collapse = request.GET.getlist("collapse", [])
        if stats_period not in (None, "", "1h", "24h", "7d", "14d", "30d", "90d"):
            return Response(
                {"error": {"params": {"stats_period": {"message": ERR_INVALID_STATS_PERIOD}}}},
                status=400,
            )
        elif not stats_period:
            # disable stats
            stats_period = None

        datasetName = request.GET.get("dataset", "discover")
        dataset = get_dataset(datasetName)

        queryset: QuerySet[Project]
        if request.auth and not request.user.is_authenticated:
            # TODO: remove this, no longer supported probably
            if hasattr(request.auth, "project"):
                queryset = Project.objects.filter(id=request.auth.project.id)
            elif request.auth.organization_id is not None:
                org = request.auth.organization_id
                team_list = list(Team.objects.filter(organization_id=org))
                queryset = Project.objects.filter(teams__in=team_list)
            else:
                return Response(
                    {"detail": "Current access does not point to organization."}, status=400
                )
        else:
            queryset = Project.objects.filter(organization=organization)

        order_by = ["slug"]

        if request.user.is_authenticated:
            queryset = queryset.extra(
                select={
                    "is_bookmarked": """exists (
                        select *
                        from sentry_projectbookmark spb
                        where spb.project_id = sentry_project.id and spb.user_id = %s
                    )"""
                },
                select_params=(request.user.id,),
            )
            order_by.insert(0, "-is_bookmarked")

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    value_s = " ".join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=value_s) | Q(slug__icontains=value_s)
                    )
                elif key == "id":
                    if all(v.isdigit() for v in value):
                        queryset = queryset.filter(id__in=value)
                    else:
                        return Response(
                            {
                                "error": {
                                    "params": {
                                        "stats_period": {
                                            "message": "All 'id' values must be integers."
                                        }
                                    }
                                }
                            },
                            status=400,
                        )
                elif key == "slug":
                    queryset = queryset.filter(slug__in=value)
                elif key == "team":
                    team_list = list(Team.objects.filter(organization=organization, slug__in=value))
                    queryset = queryset.filter(teams__in=team_list)
                elif key == "!team":
                    team_list = list(Team.objects.filter(organization=organization, slug__in=value))
                    queryset = queryset.exclude(teams__in=team_list)
                elif key == "is_member":
                    queryset = queryset.filter(teams__organizationmember__user_id=request.user.id)
                else:
                    queryset = queryset.none()

        queryset = queryset.filter(status=ObjectStatus.ACTIVE).distinct()

        # TODO(davidenwang): remove this after frontend requires only paginated projects
        get_all_projects = request.GET.get("all_projects") == "1"

        if get_all_projects:
            queryset = queryset.order_by("slug").select_related("organization")
            return Response(
                serialize(
                    list(queryset),
                    request.user,
                    ProjectSummarySerializer(collapse=collapse, dataset=dataset),
                )
            )
        else:
            expand = set()
            if request.GET.get("transactionStats"):
                expand.add("transaction_stats")
            if request.GET.get("sessionStats"):
                expand.add("session_stats")

            expand_context = {"options": request.GET.getlist("options") or []}
            if expand_context:
                expand.add("options")

            def serialize_on_result(result):
                environment_id = get_environment_id(request, organization.id)
                serializer = ProjectSummarySerializer(
                    environment_id=environment_id,
                    stats_period=stats_period,
                    expand=expand,
                    expand_context=expand_context,
                    collapse=collapse,
                    dataset=dataset,
                )
                return serialize(result, request.user, serializer)

            return self.paginate(
                request=request,
                queryset=queryset,
                order_by=order_by,
                on_results=serialize_on_result,
                paginator_cls=OffsetPaginator,
            )

    def should_add_creator_to_team(self, user: User | AnonymousUser) -> TypeIs[User]:
        return user.is_authenticated

    @extend_schema(
        tags=["Projects"],
        operation_id="Create a Project for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=ProjectPostSerializer,
        responses={
            201: ProjectSummarySerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
        examples=ProjectExamples.CREATE_PROJECT,
        description=(
            "Create a new project for an organization. A personal team (`team-{username}`) "
            "is automatically created for the caller with Team Admin role, and the project is "
            "bound to it. If the org has member project creation disabled "
            "(`disable_member_project_creation`), `org:write` scope is required."
        ),
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new project for an organization.

        Auto-creates a personal team (``team-{username}``) for the caller with Team Admin
        role, then creates the project under that team. A random suffix is appended to the
        team slug if the default name is already taken (up to five attempts).
        """
        serializer = ProjectPostSerializer(
            data=request.data, context={"organization": organization}
        )

        if not serializer.is_valid():
            raise ValidationError(serializer.errors)
        if not self.should_add_creator_to_team(request.user):
            raise NotAuthenticated("User is not authenticated")

        result = serializer.validated_data

        if not features.has("organizations:team-roles", organization):
            raise ResourceDoesNotExist(detail=MISSING_PERMISSION_ERROR_STRING)
        if organization.flags.disable_member_project_creation and not request.access.has_scope(
            "org:write"
        ):
            raise PermissionDenied(detail=DISABLED_FEATURE_ERROR_STRING)

        # parse the email to retrieve the username before the "@"
        parsed_email = fetch_slugifed_email_username(request.user.email)

        project_name = result["name"]
        default_team_slug = f"team-{parsed_email}"
        suffixed_team_slug = default_team_slug

        # attempt to a maximum of 5 times to add a suffix to team slug until it is unique
        for _ in range(5):
            if not Team.objects.filter(organization=organization, slug=suffixed_team_slug).exists():
                break
            suffixed_team_slug = f"{default_team_slug}-{_generate_suffix()}"
        else:
            raise ConflictError(
                {
                    "detail": "Unable to create a default team for this user. Please try again.",
                }
            )
        default_team_slug = suffixed_team_slug

        try:
            with transaction.atomic(router.db_for_write(Team)):
                team = Team.objects.create(
                    name=default_team_slug,
                    slug=default_team_slug,
                    idp_provisioned=result.get("idp_provisioned", False),
                    organization=organization,
                )
                member = OrganizationMember.objects.get(
                    user_id=request.user.id, organization=organization
                )
                OrganizationMemberTeam.objects.create(
                    team=team,
                    organizationmember=member,
                    role="admin",
                )
                project = Project.objects.create(
                    name=project_name,
                    # slug is *not* set so we get an automatic one
                    organization=organization,
                    platform=result.get("platform"),
                )
                project.add_team(team)
        except (IntegrityError, MaxSnowflakeRetryError):
            raise ConflictError(
                {
                    "non_field_errors": [CONFLICTING_TEAM_SLUG_ERROR],
                    "detail": CONFLICTING_TEAM_SLUG_ERROR,
                }
            )
        except OrganizationMember.DoesNotExist:
            raise PermissionDenied(
                detail="You must be a member of the organization to join a new team as a Team Admin"
            )

        team_created.send_robust(
            organization=organization,
            user=request.user,
            team=team,
            sender=self.__class__,
        )
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=team.id,
            event=audit_log.get_event_id("TEAM_ADD"),
            data=team.get_audit_log_data(),
        )

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

        apply_default_project_settings(organization, project)

        project_created.send_robust(
            project=project,
            user=request.user,
            default_rules=result.get("default_rules", True),
            origin=origin,
            sender=self,
        )
        self.create_audit_entry(
            request=request,
            organization=team.organization,
            event=audit_log.get_event_id("TEAM_AND_PROJECT_CREATED"),
            data={"team_slug": default_team_slug, "project_slug": project_name},
        )
        self.logger.info(
            "created team through project creation flow",
            extra={"team_slug": default_team_slug, "project_slug": project_name},
        )
        serialized_response = serialize(
            project, request.user, ProjectSummarySerializer(collapse=["unusedFeatures"])
        )
        serialized_response["team_slug"] = team.slug

        return Response(serialized_response, status=201)


@cell_silo_endpoint
class OrganizationProjectsCountEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        queryset = Project.objects.filter(organization=organization)

        all_projects = queryset.count()
        my_projects = queryset.filter(teams__organizationmember__user_id=request.user.id).count()

        return Response({"allProjects": all_projects, "myProjects": my_projects})
