from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
)
from sentry.investigations.endpoints.validators import FavoriteUpdateValidator
from sentry.investigations.models import Investigation, InvestigationFavoriteUser
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationsFavoriteEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Set an Investigation Favorite",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=FavoriteUpdateValidator,
        responses={
            204: constants.RESPONSE_NO_CONTENT,
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample("Example request", value={"shouldFavorite": True}, request_only=True)
        ],
    )
    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        """
        Add or remove the investigation from the authenticated user's favorites. Returns no
        body. Requires the organizations:investigations feature and open organization
        membership.
        """
        viewer_id = require_authenticated_user(request)
        validator = FavoriteUpdateValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        if validator.validated_data["should_favorite"]:
            InvestigationFavoriteUser.objects.get_or_create(
                investigation=investigation, user_id=viewer_id
            )
        else:
            InvestigationFavoriteUser.objects.filter(
                investigation=investigation, user_id=viewer_id
            ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
