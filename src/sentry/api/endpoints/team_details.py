from __future__ import absolute_import

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.decorators import sudo_required
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMemberType, Team, TeamStatus
)
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


class TeamAdminSerializer(TeamSerializer):
    owner = serializers.SlugRelatedField(slug_field='username', required=False)

    class Meta:
        model = Team
        fields = ('name', 'slug', 'owner')


class TeamDetailsEndpoint(Endpoint):
    def get(self, request, team_id):
        team = Team.objects.get(id=team_id)

        assert_perm(team, request.user, request.auth)

        return Response(serialize(team, request.user))

    @sudo_required
    def put(self, request, team_id):
        team = Team.objects.get(id=team_id)

        assert_perm(team, request.user, request.auth, access=OrganizationMemberType.ADMIN)

        # TODO(dcramer): this permission logic is duplicated from the
        # transformer
        if request.user.is_superuser or team.owner_id == request.user.id:
            serializer = TeamAdminSerializer(team, data=request.DATA, partial=True)
        else:
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
    def delete(self, request, team_id):
        team = Team.objects.get(id=team_id)

        assert_perm(team, request.user, request.auth, access=OrganizationMemberType.ADMIN)

        if team.project_set.filter(id=settings.SENTRY_PROJECT).exists():
            return Response('{"error": "Cannot remove team containing default project."}',
                            status=status.HTTP_403_FORBIDDEN)

        team.update(status=TeamStatus.PENDING_DELETION)

        # we delay the task for 5 minutes so we can implement an undo
        kwargs = {'object_id': team.id}
        delete_team.apply_async(kwargs=kwargs, countdown=60 * 5)

        AuditLogEntry.objects.create(
            organization=team.organization,
            actor=request.user,
            ip_address=request.META['REMOTE_ADDR'],
            target_object=team.id,
            event=AuditLogEntryEvent.TEAM_REMOVE,
            data=team.get_audit_log_data(),
        )

        return Response(status=204)
