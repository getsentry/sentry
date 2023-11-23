from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.code_locations import CodeLocationsSerializer
from sentry.api.utils import get_date_range_from_params
from sentry.sentry_metrics.querying.metadata import get_code_locations


@region_silo_endpoint
class OrganizationDDMMetaEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    """Get meta data for one or more metrics for a given set of projects in a time interval"""
    # Returns only code locations for now

    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(self, request: Request, organization) -> Response:
        start, end = get_date_range_from_params(request.GET)

        code_locations = get_code_locations(
            metric_mris=request.GET.getlist("metric", []),
            start=start,
            end=end,
            organization=organization,
            projects=self.get_projects(request, organization),
        )

        return Response(
            {"metrics": serialize(code_locations, request.user, CodeLocationsSerializer())},
            status=200,
        )
