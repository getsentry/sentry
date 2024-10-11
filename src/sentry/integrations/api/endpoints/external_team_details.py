import logging
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NO_CONTENT
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.integrations.api.bases.external_actor import (
    ExternalActorEndpointMixin,
    ExternalTeamSerializer,
)
from sentry.integrations.api.serializers.models.external_actor import ExternalActorSerializer
from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.team import Team

logger = logging.getLogger(__name__)


@region_silo_endpoint
@extend_schema(tags=["Integrations"])
class ExternalTeamDetailsEndpoint(TeamEndpoint, ExternalActorEndpointMixin):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str,
        team_id_or_slug: int | str,
        external_team_id: int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[Any, Any]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, team_id_or_slug, *args, **kwargs
        )
        kwargs["external_team"] = self.get_external_actor_or_404(
            external_team_id, kwargs["team"].organization
        )
        return args, kwargs

    @extend_schema(
        operation_id="Update an External Team",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.TEAM_ID_OR_SLUG,
            OrganizationParams.EXTERNAL_TEAM_ID,
        ],
        request=ExternalTeamSerializer,
        responses={
            200: ExternalActorSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=IntegrationExamples.EXTERNAL_TEAM_CREATE,
    )
    def put(self, request: Request, team: Team, external_team: ExternalActor) -> Response:
        """
        Update a team in an external provider that is currently linked to a Sentry team.
        """
        self.assert_has_feature(request, team.organization)

        serializer = ExternalTeamSerializer(
            instance=external_team,
            data={**request.data, "team_id": team.id},
            partial=True,
            context={"organization": team.organization},
        )
        if serializer.is_valid():
            updated_external_team = serializer.save()

            return Response(
                serialize(updated_external_team, request.user), status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        operation_id="Delete an External Team",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.TEAM_ID_OR_SLUG,
            OrganizationParams.EXTERNAL_TEAM_ID,
        ],
        request=None,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def delete(self, request: Request, team: Team, external_team: ExternalActor) -> Response:
        """
        Delete the link between a team from an external provider and a Sentry team.
        """
        external_team.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
