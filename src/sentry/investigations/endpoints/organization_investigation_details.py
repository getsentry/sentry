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
    OrganizationInvestigationEndpoint,
    accessible_project_ids,
    require_authenticated_user,
    require_manager_or_creator,
    serialize_permissions,
    service_error,
)
from sentry.investigations.endpoints.serializers import (
    InvestigationBlockSerializer,
    InvestigationDetailsSerializer,
)
from sentry.investigations.endpoints.validators import (
    BlockDeleteValidator,
    BlockUpdateValidator,
    InvestigationDeleteValidator,
    InvestigationUpdateValidator,
)
from sentry.investigations.models import Investigation, InvestigationBlock, InvestigationStatus
from sentry.investigations.services import (
    archive_investigation,
    delete_block,
    update_block,
    update_investigation,
)
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationsDetailsEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        data = dict(
            serialize(
                investigation,
                request.user,
                InvestigationDetailsSerializer(
                    accessible_project_ids=accessible_project_ids(self, request, organization)
                ),
            )
        )
        data["permissions"] = serialize_permissions(investigation, request, organization)
        return Response(data)

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        validator = InvestigationUpdateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(validator.validated_data)
        expected_version = values.pop("investigation_version")
        requested_project_ids = values.pop("project_ids", None)
        project_ids = accessible_project_ids(self, request, organization)
        if requested_project_ids is not None and not set(requested_project_ids).issubset(
            project_ids
        ):
            return Response(
                {"detail": "One or more projects are inaccessible."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "status" in values and values["status"] != investigation.status:
            require_manager_or_creator(request, organization, investigation)
        if investigation.status == InvestigationStatus.ARCHIVED and values != {
            "status": InvestigationStatus.ACTIVE
        }:
            return Response(
                {"detail": "Archived investigations are read-only."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            updated = update_investigation(
                investigation=investigation,
                expected_version=expected_version,
                fields=values,
                project_ids=requested_project_ids,
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        data = dict(
            serialize(
                updated,
                request.user,
                InvestigationDetailsSerializer(accessible_project_ids=project_ids),
            )
        )
        data["permissions"] = serialize_permissions(updated, request, organization)
        return Response(data)

    def delete(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        require_manager_or_creator(request, organization, investigation)
        validator = InvestigationDeleteValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            archive_investigation(
                investigation=investigation,
                expected_version=validator.validated_data["investigation_version"],
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(status=status.HTTP_204_NO_CONTENT)


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

        project_ids = accessible_project_ids(self, request, organization)
        return Response(
            serialize(
                updated,
                request.user,
                InvestigationBlockSerializer(accessible_project_ids=project_ids),
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
