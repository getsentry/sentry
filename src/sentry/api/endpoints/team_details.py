from __future__ import absolute_import

import logging

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.team import TeamEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, Team, TeamStatus
from sentry.tasks.deletion import delete_team
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('GetTeam')
def get_team_scenario(runner):
    runner.request(
        method='GET',
        path='/teams/%s/%s/' % (
            runner.org.slug, runner.default_team.slug)
    )


@scenario('UpdateTeam')
def update_team_scenario(runner):
    team = runner.utils.create_team('The Obese Philosophers', runner.org)
    runner.request(
        method='PUT',
        path='/teams/%s/%s/' % (
            runner.org.slug, team.slug),
        data={
            'name': 'The Inflated Philosophers'
        }
    )


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ('name', 'slug')

    def validate_slug(self, attrs, source):
        value = attrs[source]
        qs = Team.objects.filter(
            slug=value,
            organization=self.object.organization,
        ).exclude(id=self.object.id)
        if qs.exists():
            raise serializers.ValidationError('The slug "%s" is already in use.' % (value,))
        return attrs


class TeamDetailsEndpoint(TeamEndpoint):
    doc_section = DocSection.TEAMS

    @attach_scenarios([get_team_scenario])
    def get(self, request, team):
        """
        Retrieve a Team
        ```````````````

        Return details on an individual team.

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :auth: required
        """
        context = serialize(team, request.user)
        context['organization'] = serialize(team.organization, request.user)

        return Response(context)

    @attach_scenarios([update_team_scenario])
    def put(self, request, team):
        """
        Update a Team
        `````````````

        Update various attributes and configurable settings for the given
        team.

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string team_slug: the slug of the team to get.
        :param string name: the new name for the team.
        :param string slug: a new slug for the team.  It has to be unique
                            and available.
        :auth: required
        """
        serializer = TeamSerializer(team, data=request.DATA, partial=True)
        if serializer.is_valid():
            team = serializer.save()

            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_EDIT,
                data=team.get_audit_log_data(),
            )

            return Response(serialize(team, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @sudo_required
    def delete(self, request, team):
        """
        Delete a Team
        `````````````

        Schedules a team for deletion.

        **Note:** Deletion happens asynchronously and therefor is not
        immediate.  However once deletion has begun the state of a project
        changes and will be hidden from most public views.
        """
        logging.getLogger('sentry.deletions').info(
            'Team %s/%s (id=%s) removal requested by user (id=%s)',
            team.organization.slug, team.slug, team.id, request.user.id)

        updated = Team.objects.filter(
            id=team.id,
            status=TeamStatus.VISIBLE,
        ).update(status=TeamStatus.PENDING_DELETION)
        if updated:
            delete_team.delay(object_id=team.id, countdown=3600)

            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_REMOVE,
                data=team.get_audit_log_data(),
            )

        return Response(status=204)
