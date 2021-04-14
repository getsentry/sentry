import logging

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.models import ExternalTeam

from .external_team import ExternalTeamMixin, ExternalTeamSerializer

logger = logging.getLogger(__name__)


class ExternalTeamDetailsEndpoint(TeamEndpoint, ExternalTeamMixin):
    def convert_args(
        self, request, organization_slug, team_slug, external_team_id, *args, **kwargs
    ):
        args, kwargs = super().convert_args(request, organization_slug, team_slug, *args, **kwargs)
        try:
            kwargs["external_team"] = ExternalTeam.objects.get(
                id=external_team_id,
            )
        except ExternalTeam.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def put(self, request, team, external_team):
        """
        Update an External Team
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :pparam string external_team_id: id of external_team object
        :param string external_name: the Github/Gitlab team name.
        :param string provider: enum("github","gitlab")
        :auth: required
        """
        if not self.has_feature(request, team):
            raise PermissionDenied

        serializer = ExternalTeamSerializer(
            instance=external_team, data={**request.data, "team_id": team.id}, partial=True
        )
        if serializer.is_valid():
            updated_external_team = serializer.save()

            return Response(
                serialize(updated_external_team, request.user), status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, team, external_team):
        """
        Delete an External Team
        """
        if not self.has_feature(request, team):
            raise PermissionDenied

        external_team.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
