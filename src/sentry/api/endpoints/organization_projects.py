from __future__ import annotations

from typing import Any, List

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin, query_params, responds_with
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import (
    OrganizationProjectHiddenQuerySerializer,
    OrganizationProjectQuerySerializer,
    OrganizationProjectResponse,
    ProjectSummarySerializer,
)
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOTFOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import CURSOR_QUERY_PARAM, GLOBAL_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import Project
from sentry.projects.organization_projects import get_organization_projects

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', '14d', and '30d'"


@extend_schema(tags=["Organizations"])
class OrganizationProjectsEndpoint(OrganizationEndpoint, EnvironmentMixin):
    public = {"GET"}

    @extend_schema(
        operation_id="List an Organization's Projects",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, CURSOR_QUERY_PARAM],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationProjectResponseDict", List[OrganizationProjectResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[
            OpenApiExample(
                "Success",
                value=[
                    {
                        "dateCreated": "2018-11-06T21:19:58.536Z",
                        "firstEvent": None,
                        "hasAccess": True,
                        "id": "3",
                        "isBookmarked": False,
                        "isMember": True,
                        "name": "Prime Mover",
                        "platform": "",
                        "platforms": [],
                        "slug": "prime-mover",
                        "team": {
                            "id": "2",
                            "name": "Powerful Abolitionist",
                            "slug": "powerful-abolitionist",
                        },
                        "teams": [
                            {
                                "id": "2",
                                "name": "Powerful Abolitionist",
                                "slug": "powerful-abolitionist",
                            }
                        ],
                        "environments": ["local"],
                        "eventProcessing": {"symbolicationDegraded": False},
                        "features": ["releases"],
                        "firstTransactionEvent": True,
                        "hasSessions": True,
                        "latestRelease": None,
                        "hasUserReports": False,
                    }
                ],
            )
        ],
    )
    @query_params(
        OrganizationProjectQuerySerializer, hidden=[OrganizationProjectHiddenQuerySerializer]
    )
    @responds_with(paginated=True, paginator_cls=OffsetPaginator)
    def get(
        self,
        request: Request,
        pagination_meta: dict,
        organization,
        stats_period: str | None,
        transactionStats: str | None,
        sessionStats: str | None,
        query: str | None,
        collapse: List[str],
        all_projects: int,
    ) -> Any:
        """
        Return a list of projects bound to a organization.
        """
        order_by = ["slug"]

        queryset = get_organization_projects(
            organization,
            request.user,
            request.user.is_authenticated,
            query,
            all_projects,
            collapse,
            order_by,
        )

        if isinstance(queryset, QuerySet):
            expand = set()
            if transactionStats is not None:
                expand.add("transaction_stats")
            if sessionStats is not None:
                expand.add("session_stats")

            def serialize_on_result(result):
                environment_id = self._get_environment_id_from_request(request, organization.id)
                serializer = ProjectSummarySerializer(
                    environment_id=environment_id,
                    stats_period=stats_period,
                    expand=expand,
                    collapse=collapse,
                )
                return serialize(result, request.user, serializer)

            pagination_meta["on_results"] = serialize_on_result
            pagination_meta["order_by"] = order_by
        return queryset


class OrganizationProjectsCountEndpoint(OrganizationEndpoint, EnvironmentMixin):
    def get(self, request: Request, organization) -> Response:
        queryset = Project.objects.filter(organization=organization)

        all_projects = queryset.count()
        my_projects = queryset.filter(teams__organizationmember__user=request.user).count()

        return Response({"allProjects": all_projects, "myProjects": my_projects})
