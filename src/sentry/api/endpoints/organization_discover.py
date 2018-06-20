from __future__ import absolute_import

from datetime import datetime

from rest_framework.response import Response
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases import OrganizationMemberEndpoint

from sentry.models import Project, ProjectStatus, OrganizationMemberTeam

from sentry import roles


from sentry.utils import snuba


class OrganizationDiscoverPermission(OrganizationPermission):
    scope_map = {
        'POST': ['org:read', 'project:read']
    }


class OrganizationDiscoverEndpoint(OrganizationMemberEndpoint):
    permission_classes = (OrganizationDiscoverPermission, )

    def do_query(self, start, end, groupby, **kwargs):

        snuba_results = snuba.raw_query(
            start=start,
            end=end,
            groupby=groupby,
            referrer='discover',
            **kwargs
        )

        return snuba_results

    def has_projects_access(self, member, organization, requested_projects):
        has_global_access = roles.get(member.role).is_global
        if has_global_access:
            return True

        member_project_list = Project.objects.filter(
            organization=organization,
            teams__in=OrganizationMemberTeam.objects.filter(
                organizationmember=member,
            ).values('team'),
        ).values_list('id')

        return set(requested_projects).issubset(set(member_project_list))

    def post(self, request, organization, member):
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

        projects = data.get('projects')

        org_projects = set(Project.objects.filter(
            organization=organization,
            status=ProjectStatus.VISIBLE,
        ).values_list('id', flat=True))

        if (not isinstance(limit, int) or limit < 0 or limit > 1000):
            return Response({'detail': 'Invalid limit parameter'}, status=400)

        if not projects:
            return Response({'detail': 'No projects requested'}, status=400)

        if not set(projects).issubset(org_projects):
            return Response({'detail': 'Invalid projects'}, status=400)

        if not self.has_projects_access(member, organization, projects):
            return Response({'detail': 'Invalid projects'}, status=400)

        fmt = '%Y-%m-%dT%H:%M:%S'
        start = datetime.strptime(data['start'], fmt)
        end = datetime.strptime(data['end'], fmt)
        results = self.do_query(
            start,
            end,
            groupby,
            selected_columns=selected_columns,
            conditions=conditions,
            orderby=orderby,
            limit=limit,
            aggregations=aggregations,
            rollup=rollup,
            filter_keys=filters,
        )

        return Response(results, status=200)
