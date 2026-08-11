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
    service_error,
)
from sentry.investigations.endpoints.serializers import InvestigationDetailsSerializer
from sentry.investigations.endpoints.validators import (
    InvestigationDeleteValidator,
    InvestigationUpdateValidator,
)
from sentry.investigations.models import Investigation, InvestigationStatus
from sentry.investigations.services import archive_investigation, update_investigation
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
        return Response(
            serialize(
                investigation,
                request.user,
                InvestigationDetailsSerializer(
                    accessible_project_ids=request.access.accessible_project_ids
                ),
            )
        )

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        validator = InvestigationUpdateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        values = dict(validator.validated_data)
        expected_version = values.pop("investigation_version")
        requested_project_ids = values.pop("project_ids", None)
        project_ids = request.access.accessible_project_ids
        if requested_project_ids is not None and not set(requested_project_ids).issubset(
            project_ids
        ):
            return Response(
                {"detail": "One or more projects are inaccessible."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        restoring_only = (
            values == {"status": InvestigationStatus.ACTIVE} and requested_project_ids is None
        )
        if investigation.status == InvestigationStatus.ARCHIVED and not restoring_only:
            return Response(
                {"detail": "Archived investigations are read-only."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if values.get("status") == InvestigationStatus.ARCHIVED:
            if set(values) != {"status"} or requested_project_ids is not None:
                return Response(
                    {"detail": "Archiving cannot be combined with other changes."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                archived = archive_investigation(
                    investigation=investigation, expected_version=expected_version
                )
            except Exception as error:
                response = service_error(error)
                if response is not None:
                    return response
                raise
            return Response(
                serialize(
                    archived,
                    request.user,
                    InvestigationDetailsSerializer(accessible_project_ids=project_ids),
                )
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
        return Response(
            serialize(
                updated,
                request.user,
                InvestigationDetailsSerializer(accessible_project_ids=project_ids),
            )
        )

    def delete(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
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
