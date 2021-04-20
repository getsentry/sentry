import logging
from typing import Any

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.external_actor import ExternalActorEndpointMixin, ExternalTeamSerializer
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.models import Team

logger = logging.getLogger(__name__)


class ExternalTeamEndpoint(TeamEndpoint, ExternalActorEndpointMixin):
    def post(self, request: Any, team: Team) -> Response:
        """
        Create an External Team
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :param required string provider: enum("github", "gitlab")
        :param required string external_name: the associated Github/Gitlab team name.
        :auth: required
        """
        if not self.has_feature(request, team):
            raise PermissionDenied

        serializer = ExternalTeamSerializer(data={**request.data, "team_id": team.id})
        if serializer.is_valid():
            external_team, created = serializer.save()
            status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return Response(serialize(external_team, request.user), status=status_code)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
