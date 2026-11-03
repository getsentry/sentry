from __future__ import annotations

from drf_spectacular.utils import extend_schema
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
from sentry.investigations.endpoints.serializers import (
    InvestigationDetailsSerializer,
    InvestigationDetailsSerializerResponse,
)
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
    service_error,
)
from sentry.notebooks.models import Notebook
from sentry.notebooks.services import duplicate_investigation


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationsDuplicateEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Duplicate an Investigation",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=None,
        responses={
            201: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", InvestigationDetailsSerializerResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization, investigation: Notebook
    ) -> Response:
        """
        Copy the notebook into a new manual investigation for the current user. Copies blocks
        and parameter configuration; executions, comments, and viewer presence are not copied.
        No request body is required. Returns the new notebook. Requires an authenticated user.
        Requires the organizations:investigations feature and open organization membership.
        """
        viewer_id = require_authenticated_user(request)
        try:
            duplicate = duplicate_investigation(investigation=investigation, user_id=viewer_id)
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(
            serialize(
                duplicate,
                request.user,
                InvestigationDetailsSerializer(access=request.access),
            ),
            status=status.HTTP_201_CREATED,
        )
