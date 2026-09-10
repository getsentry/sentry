from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationBlockEndpoint,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.serializers import InvestigationBlockSerializer
from sentry.investigations.endpoints.validators import BlockDeleteValidator, BlockUpdateValidator
from sentry.investigations.models import Investigation, InvestigationBlock
from sentry.investigations.services import delete_block, update_block
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockDetailsEndpoint(OrganizationInvestigationBlockEndpoint):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    def put(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
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
                InvestigationBlockSerializer(
                    accessible_project_ids=request.access.accessible_project_ids
                ),
            )
        )

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
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
