import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.integrations.api.bases.external_actor import (
    ExternalActorEndpointMixin,
    ExternalTeamSerializer,
)
from sentry.integrations.api.serializers.models.external_actor import ExternalActorSerializer
from sentry.models.team import Team

logger = logging.getLogger(__name__)


@region_silo_endpoint
@extend_schema(tags=["Integrations"])
class ExternalTeamEndpoint(TeamEndpoint, ExternalActorEndpointMixin):
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="Create an External Team",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.TEAM_ID_OR_SLUG],
        request=ExternalTeamSerializer,
        responses={
            200: ExternalActorSerializer,
            201: ExternalActorSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=IntegrationExamples.EXTERNAL_TEAM_CREATE,
    )
    def post(self, request: Request, team: Team) -> Response:
        """
        Link a team from an external provider to a Sentry team.
        """
        self.assert_has_feature(request, team.organization)

        serializer = ExternalTeamSerializer(
            data={**request.data, "team_id": team.id}, context={"organization": team.organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        external_team, created = serializer.save()
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serialize(external_team, request.user, key="team"), status=status_code)
