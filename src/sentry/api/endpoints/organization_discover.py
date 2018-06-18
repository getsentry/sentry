from __future__ import absolute_import

from datetime import datetime

from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationDiscoverPermission
from sentry.models import Project, ProjectStatus

from sentry.utils import snuba


class OrganizationDiscoverEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDiscoverPermission, )

    def do_query(self, start, end, selected_columns=None, conditions=None, having=None, filters=None,
                 aggregations=None, orderby=None, limit=None, groupby=None, rollup=None):

        snuba_results = snuba.raw_query(
            start=start,
            end=end,
            groupby=groupby,
            selected_columns=selected_columns,
            conditions=conditions,
            having=having,
            filter_keys=filters,
            aggregations=aggregations,
            orderby=orderby,
            limit=limit,
            rollup=rollup,
            referrer='discover',
        )

        return snuba_results

    def post(self, request, organization):
        data = request.DATA

        filters = {
            'project_id': data['projects']
        } if 'projects' in data else None

        selected_columns = data.get('fields')

        orderby = data.get('orderby', '-last_seen')

        conditions = data.get('conditions')

        limit = data.get('limit', 1000)

        aggregations = data.get('aggregations')

        groupby = data.get('groupby')

        rollup = data.get('rollup')

        org_projects = [project.id for project in list(Project.objects.filter(
            organization=organization,
            status=ProjectStatus.VISIBLE,
        ))]

        if (not isinstance(limit, int) or limit < 0 or limit > 1000):
            return Response({'detail': 'Invalid limit parameter'}, status=400)

        if any(project_id not in org_projects for project_id in data['projects']):
            return Response({'detail': 'Invalid projects'}, status=400)

        fmt = '%Y-%m-%dT%H:%M:%S'
        start = datetime.strptime(data['start'], fmt)
        end = datetime.strptime(data['end'], fmt)
        results = self.do_query(
            start,
            end,
            selected_columns=selected_columns,
            conditions=conditions,
            orderby=orderby,
            limit=limit,
            aggregations=aggregations,
            groupby=groupby,
            rollup=rollup,
            filters=filters,
        )

        return Response(results, status=200)
