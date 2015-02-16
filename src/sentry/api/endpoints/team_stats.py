from __future__ import absolute_import

from rest_framework.response import Response
from six.moves import range

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint, DocSection
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import assert_perm
from sentry.models import Team, Project


class TeamStatsEndpoint(BaseStatsEndpoint):
    doc_section = DocSection.TEAMS

    def get(self, request, organization_slug, team_slug):
        """
        Retrieve event counts for a team

        **Draft:** This endpoint may change in the future without notice.

        Return a set of points representing a normalized timestamp and the
        number of events seen in the period.

            {method} {path}?since=1421092384.822244&until=1434052399.443363

        Query ranges are limited to Sentry's configured time-series resolutions.

        Parameters:

        - since: a timestamp to set the start of the query
        - until: a timestamp to set the end of the query
        - resolution: an explicit resolution to search for (i.e. 10s)

        **Note:** resolution should not be used unless you're familiar with Sentry
        internals as it's restricted to pre-defined values.
        """
        try:
            team = Team.objects.get(
                organization__slug=organization_slug,
                slug=team_slug,
            )
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        assert_perm(team, request.user, request.auth)

        projects = Project.objects.get_for_user(
            team=team,
            user=request.user,
        )

        if not projects:
            return Response([])

        data = tsdb.get_range(
            model=tsdb.models.project,
            keys=[p.id for p in projects],
            **self._parse_args(request)
        ).values()

        summarized = []
        for n in range(len(data[0])):
            total = sum(d[n][1] for d in data)
            summarized.append((data[0][n][0], total))

        return Response(summarized)
