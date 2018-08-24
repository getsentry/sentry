from __future__ import absolute_import

import re
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from sentry.api.serializers.rest_framework import ListField
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases import OrganizationEndpoint
from sentry.models import Project, ProjectStatus, OrganizationMember, OrganizationMemberTeam
from sentry.utils import snuba
from sentry import roles
from sentry import features


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
    orderby = serializers.CharField(required=False)
    conditions = ListField(
        child=ListField(),
        required=False,
        allow_null=True,
    )
    aggregations = ListField(
        child=ListField(),
        required=False,
        allow_null=True,
        default=[]
    )
    groupby = ListField(
        child=serializers.CharField(),
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

    def validate_fields(self, attrs, source):
        # If we're including exception_stacks.* or exception_frames.* fields
        # then add arrayjoin value so this gets returned as strings
        pattern = r"^(exception_stacks|exception_frames)\..+"
        match = next(
            (
                re.search(pattern, field).group(1)
                for field
                in attrs.get(source, [])
                if re.match(pattern, field)
            ),
            None
        )

        if match:
            attrs['arrayjoin'] = match

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
        ).values_list('id', flat=True)

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

        if not features.has('organizations:discover', organization, actor=request.user):
            return self.respond(status=404)

        serializer = DiscoverSerializer(
            data=request.DATA, context={
                'organization': organization, 'user': request.user})

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.object

        has_aggregations = len(serialized.get('aggregations')) > 0

        selected_columns = [] if has_aggregations else serialized.get('fields')

        # Make sure that all selected fields are in the group by clause if there
        # are aggregations
        groupby = serialized.get('groupby') or []
        fields = serialized.get('fields') or []
        if has_aggregations:
            for field in fields:
                if field not in groupby:
                    groupby.append(field)

        results = self.do_query(
            serialized.get('start'),
            serialized.get('end'),
            groupby=groupby,
            selected_columns=selected_columns,
            conditions=serialized.get('conditions'),
            orderby=serialized.get('orderby'),
            limit=serialized.get('limit'),
            aggregations=serialized.get('aggregations'),
            rollup=serialized.get('rollup'),
            filter_keys={'project_id': serialized.get('projects')},
            arrayjoin=serialized.get('arrayjoin'),
        )

        return Response(results, status=200)
