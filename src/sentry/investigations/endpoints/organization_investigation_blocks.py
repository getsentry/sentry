from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.organization_investigations import (
    OrganizationInvestigationBase,
    _accessible_project_ids,
    _require_authenticated_user,
    _serialize_investigation,
    _service_error,
)
from sentry.investigations.endpoints.serializers import (
    InvestigationBlockSerializer,
    InvestigationBlockSerializerResponse,
)
from sentry.investigations.endpoints.validators import (
    BlockCreateValidator,
    BlockDeleteValidator,
    BlockOrderValidator,
    BlockUpdateValidator,
)
from sentry.investigations.models import Investigation, InvestigationBlock
from sentry.investigations.services import (
    create_block,
    delete_block,
    reorder_blocks,
    update_block,
)
from sentry.models.organization import Organization


def _serialize_block(
    block: InvestigationBlock,
    request: Request,
    accessible_project_ids: set[int],
) -> InvestigationBlockSerializerResponse:
    return serialize(
        block,
        request.user,
        InvestigationBlockSerializer(accessible_project_ids=accessible_project_ids),
    )


class OrganizationInvestigationBlockBase(OrganizationInvestigationBase):
    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        investigation_id: str,
        block_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, investigation_id, *args, **kwargs
        )
        try:
            kwargs["block"] = InvestigationBlock.objects.select_related("investigation").get(
                id=block_id, investigation=kwargs["investigation"]
            )
        except (InvestigationBlock.DoesNotExist, ValueError):
            raise ResourceDoesNotExist
        return args, kwargs


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlocksEndpoint(OrganizationInvestigationBase):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        user_id = _require_authenticated_user(request)
        serializer = BlockCreateValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        values = dict(serializer.validated_data)
        investigation_version = values.pop("investigation_version")
        values["prompt"] = values.pop("generation_prompt", "")
        try:
            block = create_block(
                investigation=investigation,
                expected_investigation_version=investigation_version,
                user_id=user_id,
                values=values,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise

        return Response(
            _serialize_block(
                block,
                request,
                _accessible_project_ids(self, request, organization),
            ),
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockDetailsEndpoint(OrganizationInvestigationBlockBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}

    def put(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        user_id = _require_authenticated_user(request)
        if block.deleted_at is not None:
            raise ResourceDoesNotExist

        serializer = BlockUpdateValidator(data=request.data, context={"block": block})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        values = dict(serializer.validated_data)
        expected_investigation_version = values.pop("investigation_version")
        expected_block_version = values.pop("version")
        if "generation_prompt" in values:
            values["prompt"] = values.pop("generation_prompt")
        try:
            updated = update_block(
                block=block,
                expected_investigation_version=expected_investigation_version,
                expected_block_version=expected_block_version,
                user_id=user_id,
                values=values,
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise

        return Response(
            _serialize_block(
                updated,
                request,
                _accessible_project_ids(self, request, organization),
            )
        )

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        _require_authenticated_user(request)
        if block.deleted_at is not None:
            raise ResourceDoesNotExist

        serializer = BlockDeleteValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            delete_block(
                block=block,
                expected_investigation_version=serializer.validated_data["investigation_version"],
                expected_block_version=serializer.validated_data["version"],
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise

        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockOrderEndpoint(OrganizationInvestigationBase):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        _require_authenticated_user(request)
        serializer = BlockOrderValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            updated = reorder_blocks(
                investigation=investigation,
                expected_version=serializer.validated_data["investigation_version"],
                block_ids=serializer.validated_data["block_ids"],
            )
        except Exception as error:
            response = _service_error(error)
            if response is not None:
                return response
            raise

        return Response(
            _serialize_investigation(
                updated,
                request,
                organization,
                detailed=True,
                accessible_project_ids=_accessible_project_ids(self, request, organization),
            )
        )
