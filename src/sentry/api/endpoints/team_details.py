from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.team import TeamEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntry, AuditLogEntryEvent, Team, TeamStatus
from sentry.tasks.deletion import delete_team


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ('name', 'slug')

    def validate_slug(self, attrs, source):
        value = attrs[source]
        if Team.objects.filter(slug=value).exclude(id=self.object.id):
            raise serializers.ValidationError('The slug "%s" is already in use.' % (value,))
        return attrs


class TeamDetailsEndpoint(TeamEndpoint):
    doc_section = DocSection.TEAMS

    def get(self, request, team):
        """
        Retrieve a team

        Return details on an individual team.

            {method} {path}

        """
        return Response(serialize(team, request.user))

    @sudo_required
    def put(self, request, team):
        """
        Update a team

        Update various attributes and configurable settings for the given team.

            {method} {path}
            {{
              "name": "My Team Name"
            }}

        """
        serializer = TeamSerializer(team, data=request.DATA, partial=True)
        if serializer.is_valid():
            team = serializer.save()

            AuditLogEntry.objects.create(
                organization=team.organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_EDIT,
                data=team.get_audit_log_data(),
            )

            return Response(serialize(team, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @sudo_required
    def delete(self, request, team):
        """
        Delete a team

        Schedules a team for deletion.

            {method} {path}

        **Note:** Deletion happens asynchronously and therefor is not immediate.
        However once deletion has begun the state of a project changes and will
        be hidden from most public views.
        """
        updated = Team.objects.filter(
            id=team.id,
            status=TeamStatus.VISIBLE,
        ).update(status=TeamStatus.PENDING_DELETION)
        if updated:
            delete_team.delay(object_id=team.id, countdown=60 * 5)

            AuditLogEntry.objects.create(
                organization=team.organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_REMOVE,
                data=team.get_audit_log_data(),
            )

        return Response(status=204)
