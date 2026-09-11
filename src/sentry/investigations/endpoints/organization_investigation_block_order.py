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
from sentry.investigations.endpoints.validators import BlockOrderValidator
from sentry.investigations.models import Investigation
from sentry.investigations.services import reorder_blocks
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockOrderEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        require_authenticated_user(request)
        validator = BlockOrderValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            updated = reorder_blocks(
                investigation=investigation,
                expected_version=validator.validated_data["investigation_version"],
                block_ids=validator.validated_data["block_ids"],
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        return Response(
            serialize(
                updated,
                request.user,
                InvestigationDetailsSerializer(
                    accessible_project_ids=request.access.accessible_project_ids
                ),
            )
        )
