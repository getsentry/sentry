from __future__ import absolute_import

from rest_framework.response import Response
from six.moves import range

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint
from sentry.api.permissions import assert_perm
from sentry.models import Organization, Project, Team


class OrganizationStatsEndpoint(BaseStatsEndpoint):
    def get(self, request, organization_id):
        organization = Organization.objects.get_from_cache(id=organization_id)

        assert_perm(organization, request.user, request.auth)

        stat = request.GET.get('stat', 'received')
        if stat == 'received':
            stat_model = tsdb.models.project_total_received
        elif stat == 'rejected':
            stat_model = tsdb.models.project_total_rejected
        else:
            raise ValueError('Invalid stat: %s' % stat)

        team_list = Team.objects.get_for_user(
            organization=organization,
            user=request.user,
        )

        project_list = []
        for team in team_list:
            project_list.extend(Project.objects.get_for_user(
                team=team,
                user=request.user,
            ))

        if not project_list:
            return Response([])

        data = tsdb.get_range(
            model=stat_model,
            keys=[p.id for p in project_list],
            **self._parse_args(request)
        ).values()

        summarized = []
        for n in range(len(data[0])):
            total = sum(d[n][1] for d in data)
            summarized.append((data[0][n][0], total))

        return Response(summarized)
