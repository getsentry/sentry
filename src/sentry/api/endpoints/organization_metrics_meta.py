from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.models.organization import Organization


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

    def get(self, request: Request, organization: Organization) -> Response:
        data: dict[str, list[int]] = {
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


@cell_silo_endpoint
class OrganizationMetricsCompatibilitySums(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    """Return the total sum of metrics data, the null transactions and unparameterized transactions

    This is so the frontend can have an idea given its current selection of projects how good/bad the display would
    be. Generic metrics performance queries are disabled, so always report empty metrics counts.
    """

    def get(self, request: Request, organization: Organization) -> Response:
        data = {
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
