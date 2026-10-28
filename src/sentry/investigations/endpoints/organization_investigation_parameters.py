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
    organization_project_ids,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.serializers import (
    InvestigationDetailsSerializer,
    InvestigationDetailsSerializerResponse,
)
from sentry.investigations.endpoints.validators import ParameterValuesValidator
from sentry.investigations.models import Investigation
from sentry.investigations.services import update_parameter_values
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationParametersEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Update Investigation Parameter Values",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=ParameterValuesValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", InvestigationDetailsSerializerResponse
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
                value={"investigationVersion": 2, "values": {"environment": "production"}},
                request_only=True,
            )
        ],
    )
    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        """
        Save values for existing parameter keys using the current notebook version. Values must
        satisfy their definitions and constraints. Dependent blocks become stale and are not
        automatically rerun. Returns the updated notebook. Requires an authenticated user.
        Requires the organizations:investigations feature and open organization membership.
        """
        require_authenticated_user(request)
        validator = ParameterValuesValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        project_ids = organization_project_ids(organization)
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
                InvestigationDetailsSerializer(access=request.access),
            )
        )
