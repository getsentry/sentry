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
from sentry.investigations.endpoints.serializers import InvestigationBlockSerializer
from sentry.investigations.endpoints.validators import BlockCreateValidator
from sentry.investigations.models import Investigation
from sentry.investigations.services import create_block
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlocksEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        actor_id = require_authenticated_user(request)
        validator = BlockCreateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        values = dict(validator.validated_data)
        investigation_version = values.pop("investigation_version")
        values["prompt"] = values.pop("generation_prompt", "")
        try:
            block = create_block(
                investigation=investigation,
                expected_investigation_version=investigation_version,
                user_id=actor_id,
                values=values,
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        return Response(
            serialize(
                block,
                request.user,
                InvestigationBlockSerializer(
                    accessible_project_ids=request.access.accessible_project_ids
                ),
            ),
            status=status.HTTP_201_CREATED,
        )
