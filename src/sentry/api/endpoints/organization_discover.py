from __future__ import absolute_import

from datetime import datetime

from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationDiscoverPermission
from sentry.models import Project, ProjectStatus

from sentry.utils import snuba

from django.core.exceptions import ValidationError


class OrganizationDiscoverEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDiscoverPermission, )

    def do_query(self, start, end, selected_columns=[], conditions=[], having=[], filters={},
                 aggregations=[], orderby='-last_seen', limit=None, groupby=[], rollup=None):

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

        selected_columns = data['fields'] if 'fields' in data else None

        orderby = data['orderby'] if 'orderby' in data else None

        conditions = data['conditions'] if 'conditions' in data else None

        limit = data['limit'] if 'limit' in data else 1000

        aggregations = data['aggregations'] if 'aggregations' in data else None

        groupby = data['groupby'] if 'groupby' in data else None

        rollup = data['rollup'] if 'rollup' in data else None

        org_projects = [org.id for org in list(Project.objects.filter(
            organization=organization,
            status=ProjectStatus.VISIBLE,
        ))]

        if (not isinstance(limit, int) or limit < 0 or limit > 1000):
            raise ValidationError('Invalid limit parameter')

        if any(project_id not in org_projects for project_id in data['projects']):
            raise ValidationError('Invalid projects')

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
