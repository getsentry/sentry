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
    accessible_project_ids,
    require_authenticated_user,
    serialize_permissions,
    service_error,
)
from sentry.investigations.endpoints.serializers import InvestigationDetailsSerializer
from sentry.investigations.endpoints.validators import (
    ParameterValuesValidator,
    PermissionsUpdateValidator,
)
from sentry.investigations.models import Investigation
from sentry.investigations.services import update_parameter_values, update_permissions
from sentry.models.organization import Organization
from sentry.models.team import Team


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

        project_ids = accessible_project_ids(self, request, organization)
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

        data = dict(
            serialize(
                updated,
                request.user,
                InvestigationDetailsSerializer(accessible_project_ids=project_ids),
            )
        )
        data["permissions"] = serialize_permissions(updated, request, organization)
        return Response(data)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationPermissionsEndpoint(OrganizationInvestigationEndpoint):
    manager_or_creator_only = True
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "PUT": ApiPublishStatus.PRIVATE}

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        return Response(serialize_permissions(investigation, request, organization))

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        require_authenticated_user(request)
        validator = PermissionsUpdateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        team_ids = validator.validated_data["team_ids"]
        organization_team_ids = set(
            Team.objects.filter(organization=organization, id__in=team_ids).values_list(
                "id", flat=True
            )
        )
        if set(team_ids) != organization_team_ids:
            return Response(
                {"detail": "Teams must belong to the organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            permissions = update_permissions(
                investigation=investigation,
                expected_version=validator.validated_data["investigation_version"],
                editable_by_everyone=validator.validated_data["is_editable_by_everyone"],
                team_ids=team_ids,
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        investigation.permissions = permissions
        return Response(serialize_permissions(investigation, request, organization))
