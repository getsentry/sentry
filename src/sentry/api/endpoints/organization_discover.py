from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from sentry.api.serializers.rest_framework import ListField
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases import OrganizationEndpoint

from sentry.models import Project, ProjectStatus, OrganizationMember, OrganizationMemberTeam

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
    fields = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
    )
    limit = serializers.IntegerField(min_value=0, max_value=1000, required=False)
    rollup = serializers.IntegerField(required=False)
    orderby = serializers.CharField(required=False, default='-last_seen')
    conditions = ListField(
        child=ListField(),
        required=False,
        allow_null=True,
    )
    aggregations = ListField(
        child=ListField(),
        required=False,
        allow_null=True,
    )

    def __init__(self, *args, **kwargs):
        super(DiscoverSerializer, self).__init__(*args, **kwargs)
        self.member = OrganizationMember.objects.get(
            user=self.context['user'], organization=self.context['organization'])

    def validate_projects(self, attrs, source):
        organization = self.context['organization']
        member = self.member
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


class OrganizationDiscoverEndpoint(OrganizationEndpoint):
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

    def post(self, request, organization):
        serializer = DiscoverSerializer(
            data=request.DATA, context={
                'organization': organization, 'user': request.user})

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.object

        results = self.do_query(
            serialized.get('start'),
            serialized.get('end'),
            serialized.get('groupby'),
            selected_columns=serialized.get('fields'),
            conditions=serialized.get('conditions'),
            orderby=serialized.get('orderby'),
            limit=serialized.get('limit'),
            aggregations=serialized.get('aggregations'),
            rollup=serialized.get('rollup'),
            filter_keys={'project_id': serialized.get('projects')},
        )

        return Response(results, status=200)
