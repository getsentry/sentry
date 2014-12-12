from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint
from sentry.api.permissions import assert_perm
from sentry.models import Organization, Project, Team


class OrganizationStatsEndpoint(BaseStatsEndpoint):
    def get(self, request, organization_slug):
        organization = Organization.objects.get_from_cache(
            slug=organization_slug,
        )

        assert_perm(organization, request.user, request.auth)

        group = request.GET.get('group')
        if not group:
            keys = [organization.id]
        elif group == 'project':
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
            keys = [p.id for p in project_list]
        else:
            raise ValueError('Invalid group: %s' % group)

        if not keys:
            return Response([])

        stat = request.GET.get('stat', 'received')
        if stat == 'received':
            if group == 'project':
                stat_model = tsdb.models.project_total_received
            else:
                stat_model = tsdb.models.organization_total_received
        elif stat == 'rejected':
            if group == 'project':
                stat_model = tsdb.models.project_total_rejected
            else:
                stat_model = tsdb.models.organization_total_rejected
        else:
            raise ValueError('Invalid stat: %s' % stat)

        data = tsdb.get_range(
            model=stat_model,
            keys=keys,
            **self._parse_args(request)
        )

        if not group:
            data = data[organization.id]

        return Response(data)
