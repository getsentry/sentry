from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationBlockEndpoint,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.serializers import (
    InvestigationBlockSerializer,
    InvestigationBlockSerializerResponse,
)
from sentry.investigations.endpoints.validators import BlockDeleteValidator, BlockUpdateValidator
from sentry.investigations.models import Investigation, InvestigationBlock
from sentry.investigations.services import delete_block, update_block
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockDetailsEndpoint(OrganizationInvestigationBlockEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Update an Investigation Block",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.BLOCK_ID,
        ],
        request=BlockUpdateValidator,
        responses={
            200: inline_sentry_response_serializer(
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
                value={"investigationVersion": 2, "version": 1, "content": "Revised observations"},
                request_only=True,
            )
        ],
    )
    def put(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        """
        Update at least one of title, content, generationPrompt, config, or display. Send both
        notebook and block versions. The block kind cannot change. Returns the updated block.
        Requires an authenticated user. Requires the organizations:investigations feature and
        open organization membership.
        """
        actor_id = require_authenticated_user(request)
        if block.deleted_at is not None:
            raise ResourceDoesNotExist

        validator = BlockUpdateValidator(data=request.data, context={"block": block})
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        values = dict(validator.validated_data)
        expected_investigation_version = values.pop("investigation_version")
        expected_block_version = values.pop("version")
        if "generation_prompt" in values:
            values["prompt"] = values.pop("generation_prompt")
        try:
            updated = update_block(
                block=block,
                expected_investigation_version=expected_investigation_version,
                expected_block_version=expected_block_version,
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
                updated,
                request.user,
                InvestigationBlockSerializer(),
            )
        )

    @extend_schema(
        operation_id="Delete an Investigation Block",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.BLOCK_ID,
        ],
        request=BlockDeleteValidator,
        responses={
            204: constants.RESPONSE_NO_CONTENT,
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={"investigationVersion": 2, "version": 1},
                request_only=True,
            )
        ],
    )
    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        """
        Soft-delete an active block using notebook and block versions. Active executions and
        other state conflicts return 409. Returns no body. Requires an authenticated user.
        Requires the organizations:investigations feature and open organization membership.
        """
        require_authenticated_user(request)
        if block.deleted_at is not None:
            raise ResourceDoesNotExist

        validator = BlockDeleteValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            delete_block(
                block=block,
                expected_investigation_version=validator.validated_data["investigation_version"],
                expected_block_version=validator.validated_data["version"],
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        return Response(status=status.HTTP_204_NO_CONTENT)
