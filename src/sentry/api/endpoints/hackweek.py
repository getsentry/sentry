from __future__ import annotations

import functools
from typing import List

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import serializers
from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.models.organization import Organization
from sentry.models.organizationmemberteam import OrganizationMemberTeam


class PaginationSerializer(serializers.Serializer):
    per_page = serializers.IntegerField(
        help_text=("Number of results to return per page. Cannot be higher than 100."),
        required=False,
    )
    cursor = serializers.CharField(
        help_text="Cursor position. Can be used to maintain list location", required=False
    )
    order_by = serializers.CharField(
        help_text="Sort the results by the `key` selected. For example `date-added`.",
        required=False,
    )


class TeamListSerializer(serializers.Serializer):
    team = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="Teams within the organization to find matching members in.",
    )


def use_kwargs(
    qparams: List[serializers.Serializer] | None = None,
    paginate: bool = False,
):
    def inner(f):
        f.query_params = qparams
        if paginate:
            f.query_params += [PaginationSerializer]

        @functools.wraps(f)
        def view(self, request, *args, **kwargs):
            resp = f(self, request, *args, **kwargs)
            if paginate:
                return self.paginate(request=request, queryset=resp, paginator_cls=OffsetPaginator)
            return resp

        return view

    return inner


@extend_schema(tags=["Hackweek"])
class TeamMemberIntersectionEndpoint(OrganizationEndpoint):
    public = {"GET"}

    @extend_schema(
        operation_id="Find the intersection of users in teams",
        responses={200: TeamListSerializer},
        examples=[
            OpenApiExample(
                "Successful response",
                value=["john_doe", "jane_doe", "octocat", "santry"],
                status_codes=["200"],
            )
        ],
    )
    @use_kwargs(qparams=[TeamListSerializer], paginate=True)
    def get(self, request: Request, organization: Organization):
        """
        Find the intersection of users in teams

        The caller can find which users are in multiple teams. Returns a list of slugs
        """
        teams = request.GET.getlist("team")

        return OrganizationMemberTeam.objects.values_list(
            "organizationmember__user__username", flat=True
        ).filter(team__slug__in=teams, organizationmember__organization=organization)
