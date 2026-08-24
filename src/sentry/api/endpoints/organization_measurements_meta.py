from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.models.organization import Organization


@cell_silo_endpoint
class OrganizationMeasurementsMeta(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        return Response({})
