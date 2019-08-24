from __future__ import absolute_import

from rest_framework.response import Response
from six.moves import range

from sentry import tsdb
from sentry.api.base import DocSection, EnvironmentMixin, StatsMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Environment, Project
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario("RetrieveEventCountsTeam")
def retrieve_event_counts_team(runner):
    runner.request(
        method="GET", path="/teams/%s/%s/stats/" % (runner.org.slug, runner.default_team.slug)
    )


class TeamStatsEndpoint(TeamEndpoint, EnvironmentMixin, StatsMixin):
    doc_section = DocSection.TEAMS

    @attach_scenarios([retrieve_event_counts_team])
    def get(self, request, team):
        """
        Retrieve Event Counts for a Team
        ````````````````````````````````

        .. caution::
           This endpoint may change in the future without notice.

        Return a set of points representing a normalized timestamp and the
        number of events seen in the period.

        Query ranges are limited to Sentry's configured time-series
        resolutions.

        :pparam string organization_slug: the slug of the organization.
        :pparam string team_slug: the slug of the team.
        :qparam string stat: the name of the stat to query (``"received"``,
                             ``"rejected"``)
        :qparam timestamp since: a timestamp to set the start of the query
                                 in seconds since UNIX epoch.
        :qparam timestamp until: a timestamp to set the end of the query
                                 in seconds since UNIX epoch.
        :qparam string resolution: an explicit resolution to search
                                   for (one of ``10s``, ``1h``, and ``1d``)
        :auth: required
        """
        try:
            environment_id = self._get_environment_id_from_request(request, team.organization_id)
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        projects = Project.objects.get_for_user(team=team, user=request.user)

        if not projects:
            return Response([])

        data = list(
            tsdb.get_range(
                model=tsdb.models.project,
                keys=[p.id for p in projects],
                **self._parse_args(request, environment_id)
            ).values()
        )

        summarized = []
        for n in range(len(data[0])):
            total = sum(d[n][1] for d in data)
            summarized.append((data[0][n][0], total))

        return Response(summarized)
