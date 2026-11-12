from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization


class MetricsCompatibilityResponse(TypedDict):
    incompatible_projects: list[int]
    compatible_projects: list[int]


class MetricsCompatibilitySums(TypedDict):
    metrics: int
    metrics_null: int
    metrics_unparam: int


class MetricsCompatibilitySumsResponse(TypedDict):
    sum: MetricsCompatibilitySums


METRICS_COMPATIBILITY_PARAMETERS = [
    GlobalParams.ORG_ID_OR_SLUG,
    OrganizationParams.PROJECT,
    GlobalParams.ENVIRONMENT,
    GlobalParams.STATS_PERIOD,
    GlobalParams.START,
    GlobalParams.END,
]
METRICS_COMPATIBILITY_RESPONSES = {
    401: RESPONSE_UNAUTHORIZED,
    403: RESPONSE_FORBIDDEN,
    404: RESPONSE_NOT_FOUND,
}


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationMetricsCompatibility(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    """Metrics data can contain less than great data like null or unparameterized transactions

    This endpoint previously queried generic metrics to decide whether landing pages should use
    metrics or transactions. Generic metrics performance queries are disabled, so always report
    projects as incompatible and force the transactions path.
    """

    @extend_schema(
        operation_id="getOrganizationMetricsCompatibility",
        summary="Retrieve Projects' Metrics Compatibility",
        parameters=[
            *METRICS_COMPATIBILITY_PARAMETERS,
            OpenApiParameter(
                name="per_page",
                location="query",
                required=False,
                type=int,
                description="The maximum number of project IDs to return. Defaults to 50.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationMetricsCompatibilityResponse", MetricsCompatibilityResponse
            ),
            **METRICS_COMPATIBILITY_RESPONSES,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[MetricsCompatibilityResponse]:
        """
        Return which of the selected projects can use metrics-backed performance data.
        Generic metrics queries are disabled, so every selected project is reported in
        `incompatible_projects` and `compatible_projects` is always empty.
        """
        data: MetricsCompatibilityResponse = {
            "incompatible_projects": [],
            "compatible_projects": [],
        }
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(data)

        # Keep the old response shape, but do not query generic metrics.
        data["incompatible_projects"] = sorted(
            snuba_params.project_ids[: int(request.GET.get("per_page", 50))]
        )
        return Response(data)


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationMetricsCompatibilitySums(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    """Return the total sum of metrics data, the null transactions and unparameterized transactions

    This is so the frontend can have an idea given its current selection of projects how good/bad the display would
    be. Generic metrics performance queries are disabled, so always report empty metrics counts.
    """

    @extend_schema(
        operation_id="getOrganizationMetricsCompatibilitySums",
        summary="Retrieve Metrics Compatibility Counts",
        parameters=METRICS_COMPATIBILITY_PARAMETERS,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationMetricsCompatibilitySumsResponse", MetricsCompatibilitySumsResponse
            ),
            **METRICS_COMPATIBILITY_RESPONSES,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[MetricsCompatibilitySumsResponse]:
        """
        Return the number of metrics-backed transactions for the selected projects,
        including those with a null or unparameterized transaction name. Generic metrics
        queries are disabled, so all counts are always 0.
        """
        data: MetricsCompatibilitySumsResponse = {
            "sum": {
                "metrics": 0,
                "metrics_null": 0,
                "metrics_unparam": 0,
            },
        }
        try:
            self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(data)

        return Response(data)
