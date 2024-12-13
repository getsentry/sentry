from __future__ import annotations

import logging
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NO_CONTENT
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.integrations.api.bases.external_actor import (
    ExternalActorEndpointMixin,
    ExternalUserSerializer,
)
from sentry.integrations.api.serializers.models.external_actor import ExternalActorSerializer
from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.organization import Organization

logger = logging.getLogger(__name__)


@region_silo_endpoint
@extend_schema(tags=["Integrations"])
class ExternalUserDetailsEndpoint(OrganizationEndpoint, ExternalActorEndpointMixin):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str,
        external_user_id: int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        kwargs["external_user"] = self.get_external_actor_or_404(
            external_user_id, kwargs["organization"]
        )
        return args, kwargs

    @extend_schema(
        operation_id="Update an External User",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, OrganizationParams.EXTERNAL_USER_ID],
        request=ExternalUserSerializer,
        responses={
            200: ExternalActorSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=IntegrationExamples.EXTERNAL_USER_CREATE,
    )
    def put(
        self, request: Request, organization: Organization, external_user: ExternalActor
    ) -> Response:
        """
        Update a user in an external provider that is currently linked to a Sentry user.
        """
        self.assert_has_feature(request, organization)

        serializer = ExternalUserSerializer(
            instance=external_user,
            data=request.data,
            context={"organization": organization},
            partial=True,
        )
        if serializer.is_valid():
            updated_external_user = serializer.save()

            return Response(
                serialize(updated_external_user, request.user), status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        operation_id="Delete an External User",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, OrganizationParams.EXTERNAL_USER_ID],
        request=None,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def delete(
        self, request: Request, organization: Organization, external_user: ExternalActor
    ) -> Response:
        """
        Delete the link between a user from an external provider and a Sentry user.
        """
        external_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
