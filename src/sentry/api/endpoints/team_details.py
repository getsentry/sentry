from __future__ import absolute_import

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.decorators import sudo_required
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.constants import MEMBER_ADMIN, RESERVED_TEAM_SLUGS
from sentry.models import Team, TeamMember, TeamStatus
from sentry.tasks.deletion import delete_team


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ('name', 'slug')

    def validate_slug(self, attrs, source):
        value = attrs[source]
        if value in RESERVED_TEAM_SLUGS:
            raise serializers.ValidationError('You may not use "%s" as a slug.' % (value,))
        elif Team.objects.filter(slug=value).exclude(id=self.object.id):
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

        assert_perm(team, request.user, request.auth, access=MEMBER_ADMIN)

        # TODO(dcramer): this permission logic is duplicated from the
        # transformer
        if request.user.is_superuser or team.owner_id == request.user.id:
            serializer = TeamAdminSerializer(team, data=request.DATA, partial=True)
        else:
            serializer = TeamSerializer(team, data=request.DATA, partial=True)

        if serializer.is_valid():
            team = serializer.save()
            TeamMember.objects.create_or_update(
                user=team.owner,
                team=team,
                defaults={
                    'type': MEMBER_ADMIN,
                }
            )
            return Response(serialize(team, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @sudo_required
    def delete(self, request, team_id):
        team = Team.objects.get(id=team_id)

        assert_perm(team, request.user, request.auth, access=MEMBER_ADMIN)

        if team.project_set.filter(id=settings.SENTRY_PROJECT).exists():
            return Response('{"error": "Cannot remove team containing default project."}',
                            status=status.HTTP_403_FORBIDDEN)

        if not (request.user.is_superuser or team.owner_id == request.user.id):
            return Response('{"error": "You do not have permission to remove this team."}', status=status.HTTP_403_FORBIDDEN)

        team.update(status=TeamStatus.PENDING_DELETION)

        # TODO(dcramer): set status to pending deletion
        # we delay the task for 5 minutes so we can implement an undo
        delete_team.delay(object_id=team.id, countdown=60 * 5)

        return Response(status=204)
