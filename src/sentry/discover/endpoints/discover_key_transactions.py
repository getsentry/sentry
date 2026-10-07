from __future__ import annotations

from collections import defaultdict
from typing import TypedDict

from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import KeyTransactionBase
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.helpers.teams import get_teams
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_CREATED,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.key_transaction_examples import KeyTransactionExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, OrganizationParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.discover.endpoints import serializers
from sentry.discover.endpoints.discover_key_transactions_types import (
    KeyedTransaction,
    KeyTransactionTeamResponse,
    TeamKeyTransactionsResponse,
)
from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.models.projectteam import ProjectTeam
from sentry.models.team import Team


class KeyTransactionPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
        "PUT": ["org:read"],
        "DELETE": ["org:read"],
    }


KEY_TRANSACTION_PROJECT_PARAM = OpenApiParameter(
    name="project",
    location="query",
    required=True,
    type=str,
    description="The ID or slug of the project the transaction belongs to. Exactly one project is required.",
)


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class KeyTransactionEndpoint(KeyTransactionBase):
    """
    Legacy: team key transactions are only used by the AM1 performance pages. Newer plans
    star transactions per user through `InsightsStarredSegmentsEndpoint`
    (`insights/starred-segments/`), so this endpoint is intentionally kept private.
    """

    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (KeyTransactionPermission,)

    @extend_schema(
        operation_id="listOrganizationKeyTransactionTeams",
        summary="List an Organization's Teams for a Key Transaction",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            KEY_TRANSACTION_PROJECT_PARAM,
            OpenApiParameter(
                name="transaction",
                location="query",
                required=True,
                type=str,
                description="The name of the transaction.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "KeyTransactionTeamsResponse", list[KeyTransactionTeamResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=KeyTransactionExamples.LIST_KEY_TRANSACTION_TEAMS,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[KeyTransactionTeamResponse]]:
        """
        Return the teams that have marked a transaction as key, limited to teams the
        requesting user is a member of.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        transaction_name = request.GET.get("transaction")
        if transaction_name is None:
            raise ParseError(detail="A transaction name is required")

        project = self.get_project(request, organization)
        teams = Team.objects.get_for_user(organization, request.user)

        key_teams = TeamKeyTransaction.objects.filter(
            organization=organization,
            project_team__in=ProjectTeam.objects.filter(team__in=teams, project=project),
            transaction=transaction_name,
        ).order_by("project_team__team_id")

        return Response(
            serialize(list(key_teams), request.user, serializer=TeamKeyTransactionSerializer()),
            status=200,
        )

    @extend_schema(
        operation_id="createOrganizationKeyTransaction",
        summary="Mark a Transaction as Key for Teams",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, KEY_TRANSACTION_PROJECT_PARAM],
        request=serializers.TeamKeyTransactionSerializer,
        responses={
            201: RESPONSE_CREATED,
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
    )
    def post(
        self, request: Request, organization: Organization
    ) -> Response[None] | Response[DetailResponse] | Response[ValidationErrorResponse]:
        """
        Mark a transaction as key for one or more teams. Each team must have access to
        the project, and a team can have at most 100 key transactions. Returns `204` if
        every team already has the transaction marked as key.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        project = self.get_project(request, organization)

        with transaction.atomic(router.db_for_write(ProjectTeam)):
            serializer = serializers.TeamKeyTransactionSerializer(
                data=request.data,
                context={
                    "mode": "create",
                    "request": request,
                    "organization": organization,
                },
            )

            if serializer.is_valid():
                data = serializer.validated_data
                base_filter = {
                    "organization": organization,
                    "transaction": data["transaction"],
                }

                project_teams = ProjectTeam.objects.filter(project=project, team__in=data["team"])
                if len(project_teams) < len(data["team"]):
                    # some teams do not have access to the specified project
                    return Response({"detail": "Team does not have access to project"}, status=400)

                keyed_transaction_team_ids = set(
                    TeamKeyTransaction.objects.values_list(
                        "project_team__team_id", flat=True
                    ).filter(**base_filter, project_team__in=project_teams)
                )
                if len(keyed_transaction_team_ids) == len(data["team"]):
                    # all teams already have the specified transaction marked as key
                    return Response(status=204)

                try:
                    unkeyed_project_teams = project_teams.exclude(
                        team_id__in=keyed_transaction_team_ids
                    )
                    TeamKeyTransaction.objects.bulk_create(
                        [
                            TeamKeyTransaction(**base_filter, project_team=project_team)
                            for project_team in unkeyed_project_teams
                        ]
                    )
                    return Response(status=201)
                # Even though we tried to avoid it, the TeamKeyTransaction was created already
                except IntegrityError:
                    return Response(status=409)

        return Response(as_validation_errors(serializer), status=400)

    @extend_schema(
        operation_id="deleteOrganizationKeyTransaction",
        summary="Unmark a Transaction as Key for Teams",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, KEY_TRANSACTION_PROJECT_PARAM],
        request=serializers.TeamKeyTransactionSerializer,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self, request: Request, organization: Organization
    ) -> Response[None] | Response[ValidationErrorResponse]:
        """
        Remove a transaction from the key transactions of one or more teams.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        project = self.get_project(request, organization)

        serializer = serializers.TeamKeyTransactionSerializer(
            data=request.data,
            context={
                "request": request,
                "organization": organization,
            },
        )

        if serializer.is_valid():
            data = serializer.validated_data

            TeamKeyTransaction.objects.filter(
                organization=organization,
                project_team__in=ProjectTeam.objects.filter(project=project, team__in=data["team"]),
                transaction=data["transaction"],
            ).delete()

            return Response(status=204)

        return Response(as_validation_errors(serializer), status=400)


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class KeyTransactionListEndpoint(KeyTransactionBase):
    """
    Legacy: team key transactions are only used by the AM1 performance pages. Newer plans
    star transactions per user through `InsightsStarredSegmentsEndpoint`
    (`insights/starred-segments/`), so this endpoint is intentionally kept private.
    """

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (KeyTransactionPermission,)

    @extend_schema(
        operation_id="listOrganizationTeamKeyTransactions",
        summary="List an Organization's Key Transactions by Team",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            OpenApiParameter(
                name="team",
                location="query",
                required=True,
                many=True,
                type=str,
                description=(
                    "The IDs of the teams to return key transactions for. Pass `myteams` to "
                    "include every team the requesting user is a member of."
                ),
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "TeamKeyTransactionsResponse", list[TeamKeyTransactionsResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=KeyTransactionExamples.LIST_TEAM_KEY_TRANSACTIONS,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[TeamKeyTransactionsResponse]] | Response[str]:
        """
        Return the key transactions of each requested team, ordered by team slug. `count`
        is the team's total number of key transactions across all projects, while `keyed`
        only lists the ones in the requested projects.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            teams = get_teams(request, organization)
        except InvalidParams as err:
            return Response(str(err), status=400)

        projects = self.get_projects(request, organization)

        serializer = KeyTransactionTeamSerializer(projects)

        return self.paginate(
            request=request,
            queryset=teams,
            order_by="slug",
            on_results=lambda x: serialize(x, request.user, serializer),
            paginator_cls=OffsetPaginator,
        )


@register(TeamKeyTransaction)
class TeamKeyTransactionSerializer(Serializer[KeyTransactionTeamResponse]):
    def serialize(self, obj, attrs, user, **kwargs) -> KeyTransactionTeamResponse:
        return {
            "team": str(obj.project_team.team_id),
        }


class KeyTransactionTeamAttrs(TypedDict):
    count: int
    key_transactions: list[KeyedTransaction]


class KeyTransactionTeamSerializer(Serializer[TeamKeyTransactionsResponse]):
    def __init__(self, projects):
        self.project_ids = {project.id for project in projects}

    def get_attrs(self, item_list, user, **kwargs):
        team_key_transactions = (
            TeamKeyTransaction.objects.filter(
                project_team__in=ProjectTeam.objects.filter(team__in=item_list),
            )
            .select_related("project_team__project", "project_team__team")
            .order_by("transaction", "project_team__project_id")
        )

        attrs: dict[Team, KeyTransactionTeamAttrs] = defaultdict(
            lambda: {
                "count": 0,
                "key_transactions": [],
            }
        )

        for kt in team_key_transactions:
            team = kt.project_team.team
            project = kt.project_team.project
            attrs[team]["count"] += 1
            if project.id in self.project_ids:
                attrs[team]["key_transactions"].append(
                    {
                        "project_id": str(project.id),
                        "transaction": kt.transaction,
                    }
                )

        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> TeamKeyTransactionsResponse:
        return {
            "team": str(obj.id),
            "count": attrs.get("count", 0),
            "keyed": attrs.get("key_transactions", []),
        }
