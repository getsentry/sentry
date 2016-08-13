from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.models import (
    AuditLogEntryEvent, OrganizationMember, OrganizationMemberTeam,
    Team, TeamStatus
)
from sentry.utils.apidocs import scenario, attach_scenarios


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
    runner.request(
        method='GET',
        path='/organizations/%s/teams/' % runner.org.slug
    )


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)
    slug = serializers.RegexField(r'^[a-z0-9_\-]+$', max_length=50,
                                  required=False)


class OrganizationTeamsEndpoint(OrganizationEndpoint):
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

        team_list = list(Team.objects.filter(
            organization=organization,
            status=TeamStatus.VISIBLE,
        ).order_by('name', 'slug'))

        return Response(serialize(
            team_list, request.user, TeamWithProjectsSerializer()))

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
                        name=result['name'],
                        slug=result.get('slug'),
                        organization=organization,
                    )
            except IntegrityError:
                return Response(
                    {'detail': 'A team with this slug already exists.'},
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
