import logging
from typing import Any, Tuple

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.external_actor import ExternalActorEndpointMixin, ExternalTeamSerializer
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.models import ExternalActor, Team

logger = logging.getLogger(__name__)


class ExternalTeamDetailsEndpoint(TeamEndpoint, ExternalActorEndpointMixin):  # type: ignore
    def convert_args(
        self,
        request: Request,
        organization_slug: str,
        team_slug: str,
        external_team_id: int,
        *args: Any,
        **kwargs: Any,
    ) -> Tuple[Any, Any]:
        args, kwargs = super().convert_args(request, organization_slug, team_slug, *args, **kwargs)

        kwargs["external_team"] = self.get_external_actor_or_404(external_team_id)
        return args, kwargs

    def put(self, request: Request, team: Team, external_team: ExternalActor) -> Response:
        """
        Update an External Team
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :pparam string external_team_id: id of external_team object
        :param string external_id: the associated user ID for this provider
        :param string external_name: the Github/Gitlab team name.
        :param string provider: enum("github","gitlab")
        :auth: required
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

    def delete(self, request: Request, team: Team, external_team: ExternalActor) -> Response:
        """
        Delete an External Team
        """
        self.assert_has_feature(request, team.organization)

        external_team.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
