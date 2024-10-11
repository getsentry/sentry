import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.integrations.api.bases.external_actor import (
    ExternalActorEndpointMixin,
    ExternalUserSerializer,
)
from sentry.integrations.api.serializers.models.external_actor import ExternalActorSerializer
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)


@region_silo_endpoint
@extend_schema(tags=["Integrations"])
class ExternalUserEndpoint(OrganizationEndpoint, ExternalActorEndpointMixin):
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="Create an External User",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=ExternalUserSerializer,
        responses={
            200: ExternalActorSerializer,
            201: ExternalActorSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=IntegrationExamples.EXTERNAL_USER_CREATE,
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Link a user from an external provider to a Sentry user.
        """
        self.assert_has_feature(request, organization)

        serializer = ExternalUserSerializer(
            data=request.data, context={"organization": organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        external_user, created = serializer.save()
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serialize(external_user, request.user, key="user"), status=status_code)
