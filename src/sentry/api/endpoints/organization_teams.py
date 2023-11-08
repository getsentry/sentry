from typing import List

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.fields.sentry_slug import SentrySlugField
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamSerializer, TeamSerializerResponse
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.team_examples import TeamExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, TeamParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus
from sentry.search.utils import tokenize_query
from sentry.signals import team_created
from sentry.utils.snowflake import MaxSnowflakeRetryError

CONFLICTING_SLUG_ERROR = "A team with this slug already exists."


# OrganizationPermission + team:write
class OrganizationTeamsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:write", "org:admin", "team:write"],
        "PUT": ["org:write", "org:admin", "team:write"],
        "DELETE": ["org:admin", "team:write"],
    }


@extend_schema_serializer(exclude_fields=["idp_provisioned"], deprecate_fields=["name"])
class TeamPostSerializer(serializers.Serializer):
    slug = SentrySlugField(
        help_text="""Uniquely identifies a team and is used for the interface. If not
        provided, it is automatically generated from the name.""",
        max_length=50,
        required=False,
        allow_null=True,
    )
    name = serializers.CharField(
        help_text="""**`[DEPRECATED]`** The name for the team. If not provided, it is
        automatically generated from the slug""",
        max_length=64,
        required=False,
        allow_null=True,
        allow_blank=True,
    )
    idp_provisioned = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if not (attrs.get("name") or attrs.get("slug")):
            raise serializers.ValidationError("Name or slug is required")
        return attrs


@extend_schema(tags=["Teams"])
@region_silo_endpoint
class OrganizationTeamsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationTeamsPermission,)

    def team_serializer_for_post(self):
        # allow child routes to supply own serializer, used in SCIM teams route
        return TeamSerializer()

    @extend_schema(
        operation_id="List an Organization's Teams",
        parameters=[
            GlobalParams.ORG_SLUG,
            TeamParams.DETAILED,
            CursorQueryParam,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListOrgTeamResponse", List[TeamSerializerResponse]
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TeamExamples.LIST_ORG_TEAMS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Returns a list of teams bound to a organization.
        """
        # TODO(dcramer): this should be system-wide default for organization
        # based endpoints
        if request.auth and hasattr(request.auth, "project"):
            return Response(status=403)

        queryset = (
            Team.objects.filter(organization=organization, status=TeamStatus.ACTIVE)
            .order_by("slug")
            .select_related("organization")  # Used in TeamSerializer
        )

        query = request.GET.get("query")

        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "hasExternalTeams":
                    has_external_teams = "true" in value
                    if has_external_teams:
                        queryset = queryset.filter(
                            id__in=ExternalActor.objects.filter(
                                organization=organization
                            ).values_list("team_id")
                        )
                    else:
                        queryset = queryset.exclude(
                            id__in=ExternalActor.objects.filter(
                                organization=organization
                            ).values_list("team_id")
                        )

                elif key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
                elif key == "slug":
                    queryset = queryset.filter(slug__in=value)
                elif key == "id":
                    try:
                        value = [int(item) for item in value]
                    except ValueError:
                        raise ParseError(detail="Invalid id value")
                    queryset = queryset.filter(id__in=value)
                else:
                    queryset = queryset.none()

        is_detailed = request.GET.get("detailed", "1") != "0"

        expand = ["projects", "externalTeams"] if is_detailed else []

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="slug",
            on_results=lambda x: serialize(x, request.user, TeamSerializer(expand=expand)),
            paginator_cls=OffsetPaginator,
        )

    def should_add_creator_to_team(self, request: Request):
        return request.user.is_authenticated

    @extend_schema(
        operation_id="Create a New Team",
        parameters=[
            GlobalParams.ORG_SLUG,
        ],
        request=TeamPostSerializer,
        responses={
            201: TeamSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: OpenApiResponse(description="A team with this slug already exists."),
        },
        examples=TeamExamples.CREATE_TEAM,
    )
    def post(self, request: Request, organization, **kwargs) -> Response:
        """
        Create a new team bound to an organization. Requires at least one of the `name`
        or `slug` body params to be set.
        """
        serializer = TeamPostSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            try:
                with transaction.atomic(router.db_for_write(Team)):
                    team = Team.objects.create(
                        name=result.get("name") or result["slug"],
                        slug=result.get("slug"),
                        idp_provisioned=result.get("idp_provisioned", False),
                        organization=organization,
                    )
            except (IntegrityError, MaxSnowflakeRetryError):
                return Response(
                    {
                        "non_field_errors": [CONFLICTING_SLUG_ERROR],
                        "detail": CONFLICTING_SLUG_ERROR,
                    },
                    status=409,
                )
            else:
                team_created.send_robust(
                    organization=organization, user=request.user, team=team, sender=self.__class__
                )
            if self.should_add_creator_to_team(request):
                try:
                    member = OrganizationMember.objects.get(
                        user_id=request.user.id, organization=organization
                    )
                except OrganizationMember.DoesNotExist:
                    pass
                else:
                    OrganizationMemberTeam.objects.create(team=team, organizationmember=member)

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=team.id,
                event=audit_log.get_event_id("TEAM_ADD"),
                data=team.get_audit_log_data(),
            )
            return Response(
                serialize(team, request.user, self.team_serializer_for_post()),
                status=201,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
