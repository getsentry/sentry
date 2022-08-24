from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.apidocs.parameters import GLOBAL_PARAMS
from sentry.hackweek.utils import TeamListSerializer, sentry_api
from sentry.models.organization import Organization
from sentry.models.organizationmemberteam import OrganizationMemberTeam


@extend_schema(tags=["Hackweek"])
class OldTeamMemberIntersectionEndpoint(OrganizationEndpoint):
    public = {"GET"}

    # Documentation boilerplate
    @extend_schema(
        operation_id="Find the intersection of users in teams (Old)",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, TeamListSerializer],
        responses={200: TeamListSerializer},
        examples=[
            OpenApiExample(
                "Successful response",
                value=["john_doe", "jane_doe", "octocat", "santry"],
                status_codes=["200"],
            )
        ],
    )
    def get(self, request: Request, organization: Organization):
        """
        The caller can find which users are in multiple teams. Returns a list of slugs
        """
        # Validation Boiler plate
        teams = request.GET.getlist("teams")
        if len(teams) < 2:
            return Response(data={"message": "At least 2 teams are required"}, status=400)
        per_page = request.GET.get("per_page")
        if per_page is not None and per_page < 1 or per_page > 100:
            return Response(data={"message": "per_page must be between 1 and 100"}, status=400)

        # Meat and potatoes
        queryset = OrganizationMemberTeam.objects.values_list(
            "organizationmember__user__username", flat=True
        ).filter(team__slug__in=teams["teams"], organizationmember__organization=organization)

        # More boilerplate
        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=OffsetPaginator,
        )


@extend_schema(tags=["Hackweek"])
class TeamMemberIntersectionEndpoint(OrganizationEndpoint):
    public = {"GET"}

    @sentry_api(params=[TeamListSerializer], paginate=True, responds_with=TeamListSerializer)
    def get(self, request: Request, organization: Organization, teams: dict):
        """
        Find the intersection of users in teams

        The caller can find which users are in multiple teams. Returns a list of slugs
        """
        return OrganizationMemberTeam.objects.values_list(
            "organizationmember__user__username", flat=True
        ).filter(team__slug__in=teams["teams"], organizationmember__organization=organization)
