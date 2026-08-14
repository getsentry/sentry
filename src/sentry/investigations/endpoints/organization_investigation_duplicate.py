from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.serializers import InvestigationDetailsSerializer
from sentry.investigations.models import Investigation
from sentry.investigations.services import duplicate_investigation
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationsDuplicateEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        viewer_id = require_authenticated_user(request)
        try:
            duplicate = duplicate_investigation(investigation=investigation, user_id=viewer_id)
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            serialize(
                duplicate,
                request.user,
                InvestigationDetailsSerializer(
                    accessible_project_ids=request.access.accessible_project_ids
                ),
            ),
            status=status.HTTP_201_CREATED,
        )
