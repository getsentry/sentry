from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    service_error,
)
from sentry.investigations.models import Investigation
from sentry.investigations.services.investigations import InvestigationServiceError
from sentry.investigations.services.orchestration import get_orchestration_projection
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationOrchestrationEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        try:
            projection = get_orchestration_projection(investigation)
        except InvestigationServiceError as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(projection)
