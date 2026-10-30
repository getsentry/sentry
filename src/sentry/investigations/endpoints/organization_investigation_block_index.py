from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
    service_error,
)
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.serializers import (
    InvestigationBlockSerializer,
    InvestigationBlockSerializerResponse,
)
from sentry.notebooks.endpoints.validators import BlockCreateValidator
from sentry.notebooks.models import Notebook
from sentry.notebooks.services import create_block


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlocksEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Create an Investigation Block",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=BlockCreateValidator,
        responses={
            201: inline_sentry_response_serializer(
                "InvestigationBlockResponse", InvestigationBlockSerializerResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={
                    "investigationVersion": 1,
                    "kind": "text",
                    "content": "Initial observations",
                },
                request_only=True,
            )
        ],
    )
    def post(
        self, request: Request, organization: Organization, investigation: Notebook
    ) -> Response:
        """
        Append a text or query block to an active investigation. Uses investigationVersion for
        concurrency. Returns the new block; fetch investigation details for the updated notebook
        version. Requires an authenticated user. Requires the organizations:investigations
        feature and open organization membership.
        """
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
                InvestigationBlockSerializer(),
            ),
            status=status.HTTP_201_CREATED,
        )
