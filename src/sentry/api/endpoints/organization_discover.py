from __future__ import absolute_import

import re

import six

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

        fields = kwargs['data'].get('fields') or []

        match = next(
            (
                self.get_array_field(field).group(1)
                for field
                in fields
                if self.get_array_field(field) is not None
            ),
            None
        )
        self.arrayjoin = match if match else None

    def validate(self, data):
        data['arrayjoin'] = self.arrayjoin
        return data

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

    def validate_conditions(self, attrs, source):
        # Handle exception_stacks, exception_frames
        if attrs.get(source):
            conditions = [self.get_condition(condition) for condition in attrs[source]]
            attrs[source] = conditions
        return attrs

    def get_array_field(self, field):
        pattern = r"^(exception_stacks|exception_frames)\..+"
        return re.search(pattern, field)

    def get_condition(self, condition):
        array_field = self.get_array_field(condition[0])
        has_equality_operator = condition[1] in ('=', '!=')

        # Apply has function to any array field if it's = / != and not part of arrayjoin
        if array_field and has_equality_operator and (array_field.group(1) != self.arrayjoin):
            value = condition[2]

            if (isinstance(value, six.string_types)):
                value = u"'{}'".format(value)

            bool_value = 1 if condition[1] == '=' else 0

            return [['has', [array_field.group(0), value]], '=', bool_value]

        return condition

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
