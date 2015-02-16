from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Team


class TeamEndpoint(Endpoint):
    def convert_args(self, request, organization_slug, team_slug, *args, **kwargs):
        try:
            team = Team.objects.get(
                organization__slug=organization_slug,
                slug=team_slug,
            )
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        kwargs['team'] = team
        return (args, kwargs)
