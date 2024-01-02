from typing import Any, List

from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import (
    OrganizationProjectResponse,
    ProjectSummarySerializer,
)
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.search.utils import tokenize_query
from sentry.snuba import discover, metrics_enhanced_performance, metrics_performance

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', '14d', and '30d'"

DATASETS = {
    "": discover,  # in case they pass an empty query string fall back on default
    "discover": discover,
    "metricsEnhanced": metrics_enhanced_performance,
    "metrics": metrics_performance,
}


def get_dataset(dataset_label: str) -> Any:
    if dataset_label not in DATASETS:
        raise ParseError(detail=f"dataset must be one of: {', '.join(DATASETS.keys())}")
    return DATASETS[dataset_label]


@extend_schema(tags=["Organizations"])
@region_silo_endpoint
class OrganizationProjectsEndpoint(OrganizationEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="List an Organization's Projects",
        parameters=[GlobalParams.ORG_SLUG, CursorQueryParam],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationProjectResponseDict", List[OrganizationProjectResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationExamples.LIST_PROJECTS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Return a list of projects bound to a organization.
        """
        stats_period = request.GET.get("statsPeriod")
        collapse = request.GET.getlist("collapse", [])
        if stats_period not in (None, "", "1h", "24h", "7d", "14d", "30d"):
            return Response(
                {"error": {"params": {"stats_period": {"message": ERR_INVALID_STATS_PERIOD}}}},
                status=400,
            )
        elif not stats_period:
            # disable stats
            stats_period = None

        datasetName = request.GET.get("dataset", "discover")
        dataset = get_dataset(datasetName)

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
                    {"detail": "Current access does not point to " "organization."}, status=400
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
                    value = " ".join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
                elif key == "id":
                    queryset = queryset.filter(id__in=value)
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
                environment_id = self._get_environment_id_from_request(request, organization.id)
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


@region_silo_endpoint
class OrganizationProjectsCountEndpoint(OrganizationEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        queryset = Project.objects.filter(organization=organization)

        all_projects = queryset.count()
        my_projects = queryset.filter(teams__organizationmember__user_id=request.user.id).count()

        return Response({"allProjects": all_projects, "myProjects": my_projects})
