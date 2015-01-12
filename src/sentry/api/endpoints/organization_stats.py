from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint, DocSection
from sentry.api.permissions import assert_perm
from sentry.models import Organization, Project, Team


class OrganizationStatsEndpoint(BaseStatsEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization_slug):
        """
        Retrieve event counts for an organization

        **Draft:** This endpoint may change in the future without notice.

        Return a set of points representing a normalized timestamp and the
        number of events seen in the period.

            {method} {path}?since=1421092384.822244&until=1434052399.443363

        Query ranges are limited to Sentry's configured time-series resolutions.

        Parameters:

        - since: a timestamp to set the start of the query
        - until: a timestamp to set the end of the query
        - resolution: an explicit resolution to search for (i.e. 10s)
        - stat: the name of the stat to query (received, rejected)

        **Note:** resolution should not be used unless you're familiar with Sentry
        internals as it's restricted to pre-defined values.
        """
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
