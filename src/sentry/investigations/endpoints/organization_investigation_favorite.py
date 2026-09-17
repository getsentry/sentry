from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
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
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}

    def put(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
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
