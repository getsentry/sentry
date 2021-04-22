import logging

from rest_framework import status  # type: ignore
from rest_framework.request import Request  # type: ignore
from rest_framework.response import Response  # type: ignore

from sentry.api.bases.external_actor import ExternalActorEndpointMixin, ExternalTeamSerializer
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.models import Team

logger = logging.getLogger(__name__)


class ExternalTeamEndpoint(TeamEndpoint, ExternalActorEndpointMixin):  # type: ignore
    def post(self, request: Request, team: Team) -> Response:
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
        self.assert_has_feature(request, team.organization)

        serializer = ExternalTeamSerializer(
            data={**request.data, "team_id": team.id}, context={"organization": team.organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        external_team, created = serializer.save()
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serialize(external_team, request.user, key="team"), status=status_code)
