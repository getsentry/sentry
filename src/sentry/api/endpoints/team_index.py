from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import Team
from sentry.permissions import can_create_teams
from sentry.utils.functional import extract_lazy_object


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ('name', 'slug')


class TeamAdminSerializer(TeamSerializer):
    owner = serializers.SlugRelatedField(slug_field='username', required=False)

    class Meta:
        model = Team
        fields = ('name', 'slug', 'owner')


class TeamIndexEndpoint(Endpoint):
    def get(self, request):
        teams = Team.objects.get_for_user(request.user).values()
        return Response(serialize(teams, request.user))

    def post(self, request):
        if not can_create_teams(request.user):
            return Response(status=403)

        # HACK(dcramer): we want owner to be optional
        team = Team(owner=extract_lazy_object(request.user))
        if request.user.is_superuser:
            serializer = TeamAdminSerializer(team, data=request.DATA, partial=True)
        else:
            serializer = TeamSerializer(team, data=request.DATA, partial=True)

        if serializer.is_valid():
            team = serializer.save()
            return Response(serialize(team, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
