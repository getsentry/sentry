from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.serializers import InvestigationDetailsSerializer
from sentry.investigations.endpoints.validators import ParameterValuesValidator
from sentry.investigations.models import Investigation
from sentry.investigations.services import update_parameter_values
from sentry.models.organization import Organization
from sentry.models.project import Project


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationParametersEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        require_authenticated_user(request)
        validator = ParameterValuesValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        project_ids = frozenset(
            Project.objects.filter(
                id__in=request.access.accessible_project_ids,
                organization_id=organization.id,
                status=ObjectStatus.ACTIVE,
            ).values_list("id", flat=True)
        )
        try:
            updated = update_parameter_values(
                investigation=investigation,
                expected_version=validator.validated_data["investigation_version"],
                values=validator.validated_data["values"],
                accessible_project_ids=project_ids,
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
