from __future__ import absolute_import

import six

from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.models import (
    AuditLogEntryEvent, OrganizationMember, OrganizationMemberTeam, Team, TeamStatus
)
from sentry.search.utils import tokenize_query
from sentry.utils.apidocs import scenario, attach_scenarios

CONFLICTING_SLUG_ERROR = 'A team with this slug already exists.'


@scenario('CreateNewTeam')
def create_new_team_scenario(runner):
    runner.request(
        method='POST',
        path='/organizations/%s/teams/' % runner.org.slug,
        data={
            'name': 'Ancient Gabelers',
        }
    )


@scenario('ListOrganizationTeams')
def list_organization_teams_scenario(runner):
    runner.request(method='GET', path='/organizations/%s/teams/' % runner.org.slug)


# OrganizationPermission + team:write
class OrganizationTeamsPermission(OrganizationPermission):
    def __init__(self):
        for m in 'POST', 'PUT', 'DELETE':
            self.scope_map[m].append('team:write')


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False)
    slug = serializers.RegexField(r'^[a-z0-9_\-]+$', max_length=50, required=False)

    def validate(self, attrs):
        if not (attrs.get('name') or attrs.get('slug')):
            raise serializers.ValidationError('Name or slug is required')
        return attrs


class OrganizationTeamsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationTeamsPermission,)
    doc_section = DocSection.TEAMS

    @attach_scenarios([list_organization_teams_scenario])
    def get(self, request, organization):
        """
        List an Organization's Teams
        ````````````````````````````

        Return a list of teams bound to a organization.

        :pparam string organization_slug: the slug of the organization for
                                          which the teams should be listed.
        :auth: required
        """
        # TODO(dcramer): this should be system-wide default for organization
        # based endpoints
        if request.auth and hasattr(request.auth, 'project'):
            return Response(status=403)

        queryset = Team.objects.filter(
            organization=organization,
            status=TeamStatus.VISIBLE,
        ).order_by('slug')

        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == 'query':
                    value = ' '.join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
                else:
                    queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='slug',
            on_results=lambda x: serialize(x, request.user, TeamWithProjectsSerializer()),
            paginator_cls=OffsetPaginator,
        )

    @attach_scenarios([create_new_team_scenario])
    def post(self, request, organization):
        """
        Create a new Team
        ``````````````````

        Create a new team bound to an organization.  Only the name of the
        team is needed to create it, the slug can be auto generated.

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :param string name: the name of the organization.
        :param string slug: the optional slug for this organization.  If
                            not provided it will be auto generated from the
                            name.
        :auth: required
        """
        serializer = TeamSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            try:
                with transaction.atomic():
                    team = Team.objects.create(
                        name=result.get('name') or result['slug'],
                        slug=result.get('slug'),
                        organization=organization,
                    )
            except IntegrityError:
                return Response(
                    {
                        'non_field_errors': [CONFLICTING_SLUG_ERROR],
                        'detail': CONFLICTING_SLUG_ERROR,
                    },
                    status=409,
                )

            if request.user.is_authenticated():
                try:
                    member = OrganizationMember.objects.get(
                        user=request.user,
                        organization=organization,
                    )
                except OrganizationMember.DoesNotExist:
                    pass
                else:
                    OrganizationMemberTeam.objects.create(
                        team=team,
                        organizationmember=member,
                    )

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_ADD,
                data=team.get_audit_log_data(),
            )

            return Response(serialize(team, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
