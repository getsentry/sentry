from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import Team, User
from sentry.permissions import can_create_teams


class UserField(serializers.WritableField):
    def to_native(self, obj):
        return obj.username

    def from_native(self, data):
        if not data:
            return None

        try:
            return User.objects.get(username__iexact=data)
        except User.DoesNotExist:
            raise serializers.ValidationError('Unable to find user')


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)
    slug = serializers.CharField(max_length=200, required=False)
    owner = UserField(required=False, read_only=True)


class TeamAdminSerializer(TeamSerializer):
    owner = UserField(required=False)


class TeamIndexEndpoint(Endpoint):
    def get(self, request):
        if request.auth:
            teams = [request.auth.project.team]
        else:
            teams = Team.objects.get_for_user(request.user).values()
        return Response(serialize(teams, request.user))

    def post(self, request):
        if not can_create_teams(request.user):
            return Response(status=403)

        if request.user.is_superuser:
            serializer = TeamAdminSerializer(data=request.DATA)
        else:
            serializer = TeamSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object
            team = Team.objects.create(
                name=result['name'],
                slug=result.get('slug'),
                owner=result.get('owner') or request.user,
            )
            return Response(serialize(team, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
