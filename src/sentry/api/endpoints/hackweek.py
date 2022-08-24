from __future__ import annotations

import functools
from typing import List

from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_serializer
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.apidocs.parameters import GLOBAL_PARAMS
from sentry.models.organization import Organization
from sentry.models.organizationmemberteam import OrganizationMemberTeam


class PaginationSerializer(serializers.Serializer):
    per_page = serializers.IntegerField(
        help_text=("Number of results to return per page. Cannot be higher than 100."),
        required=False,
        max_value=100,
        min_value=1,
    )
    cursor = serializers.CharField(
        help_text="Cursor position. Can be used to maintain list location", required=False
    )
    order_by = serializers.CharField(
        help_text="Sort the results by the `key` selected. For example `date-added`.",
        required=False,
    )


@extend_schema_serializer(
    examples=[
        OpenApiExample(
            "Successful response",
            value=["john_doe", "jane_doe", "octocat", "santry"],
            status_codes=["200"],
            response_only=True,
            request_only=False,
        ),
    ]
)
class TeamListSerializer(serializers.Serializer):
    argument_name = "teams"
    teams = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        help_text="Teams within the organization to find matching members in. At least 2 required",
    )

    def validate_teams(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("At least 2 teams are required for the API")
        return value


class DemoSerializer(serializers.Serializer):
    argument_name = "demo_map"
    foo = serializers.ChoiceField(
        choices=("foo", "bar", "baz"),
        required=False,
        help_text="If you wanted to include a choice field, you can do it like this.",
    )
    strange_key = serializers.CharField(
        help_text="You can even do custom validations", required=False
    )

    def validate_strange_key(self, value):
        if len(value) < 3 or value[1] != "e":
            raise serializers.ValidationError(
                "strange_key is invalid. It must be longer than 3 characters and the 2nd character must be an e"
            )
        return value


def sentry_api(
    params: List[serializers.Serializer] | None = None,
    paginate: bool = False,
    responds_with: serializers.Serializer | None = None,
):
    def inner(f):
        f.query_params = params
        if paginate:
            f.query_params += [PaginationSerializer]
        f.response_serializer = responds_with
        f.get_description_from_doc = True

        @functools.wraps(f)
        def view(self, request, *args, **kwargs):
            for serializer_cls in f.query_params:
                serialized_data = serializer_cls(data=request.GET)
                serialized_data.is_valid(raise_exception=True)

                if serializer_cls != PaginationSerializer:
                    kwargs[serializer_cls.argument_name] = serialized_data.validated_data

            resp = f(self, request, *args, **kwargs)
            if paginate:
                return self.paginate(request=request, queryset=resp, paginator_cls=OffsetPaginator)
            return resp

        return view

    return inner


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


@extend_schema(tags=["Hackweek"])
class OldTeamMemberIntersectionEndpoint(OrganizationEndpoint):
    public = {"GET"}

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
        # Now we need to validate
        teams = request.GET.getlist("teams")
        if len(teams) < 2:
            return Response(data={"message": "At least 2 teams are required"}, status=400)
        per_page = request.GET.get("per_page")
        if per_page is not None and per_page < 1 or per_page > 100:
            return Response(data={"message": "per_page must be between 1 and 100"}, status=400)

        queryset = OrganizationMemberTeam.objects.values_list(
            "organizationmember__user__username", flat=True
        ).filter(team__slug__in=teams["teams"], organizationmember__organization=organization)

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=OffsetPaginator,
        )
