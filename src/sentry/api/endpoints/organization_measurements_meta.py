from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import start_span

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.models.organization import Organization
from sentry.search.events.constants import METRIC_FUNCTION_LIST_BY_TYPE
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.datasource import get_custom_measurements


@region_silo_endpoint
class OrganizationMeasurementsMeta(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        with self.handle_query_errors():
            metric_meta = get_custom_measurements(
                project_ids=params["project_id"],
                organization_id=organization.id,
                start=params["start"],
                end=params["end"],
                use_case_id=UseCaseID.TRANSACTIONS,
            )

        with start_span(op="transform", description="metric meta"):
            result = {
                item["name"]: {
                    "functions": METRIC_FUNCTION_LIST_BY_TYPE[item["type"]],
                    "unit": item["unit"],
                }
                for item in metric_meta
            }

        return Response(result)
