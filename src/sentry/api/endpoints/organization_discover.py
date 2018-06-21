from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from sentry.api.serializers.rest_framework import ListField
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases import OrganizationMemberEndpoint

from sentry.models import Project, ProjectStatus, OrganizationMemberTeam

from sentry import roles


from sentry.utils import snuba


class OrganizationDiscoverPermission(OrganizationPermission):
    scope_map = {
        'POST': ['org:read', 'project:read']
    }


class DiscoverSerializer(serializers.Serializer):
    projects = ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_null=False,
    )
    start = serializers.DateTimeField(required=True)
    end = serializers.DateTimeField(required=True)
    limit = serializers.IntegerField(min_value=0, max_value=1000, required=False)

    def validate_projects(self, attrs, source):
        organization = self.context['organization']
        member = self.context['member']
        projects = attrs[source]

        org_projects = set(Project.objects.filter(
            organization=organization,
            status=ProjectStatus.VISIBLE,
        ).values_list('id', flat=True))

        if not set(projects).issubset(org_projects) or not self.has_projects_access(
                member, organization, projects):
            raise PermissionDenied

        return attrs

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

        serializer = DiscoverSerializer(
            data=request.DATA, context={
                'organization': organization, 'member': member})

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.object

        results = self.do_query(
            serialized['start'],
            serialized['end'],
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
