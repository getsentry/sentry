from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.constants import MEMBER_ADMIN, MEMBER_SYSTEM, MEMBER_USER
from sentry.models import Team, AccessGroup


class AccessTypeField(serializers.ChoiceField):
    DEFAULT_CHOICES = (
        (MEMBER_USER, 'User'),
        (MEMBER_ADMIN, 'Admin'),
    )

    def __init__(self, choices=DEFAULT_CHOICES, *args, **kwargs):
        super(AccessTypeField, self).__init__(choices=choices, *args, **kwargs)

    def to_native(self, obj):
        if obj == MEMBER_ADMIN:
            return 'admin'
        elif obj == MEMBER_USER:
            return 'user'
        elif obj == MEMBER_SYSTEM:
            return 'agent'
        else:
            raise ValueError(obj)

    def from_native(self, obj):
        if obj == 'admin':
            return MEMBER_ADMIN
        elif obj == 'user':
            return MEMBER_USER
        elif obj == 'agent':
            return MEMBER_SYSTEM
        else:
            raise ValueError(obj)


class AccessGroupSerializer(serializers.ModelSerializer):
    type = AccessTypeField()

    class Meta:
        model = AccessGroup
        fields = ('name', 'type')


class TeamAccessGroupIndexEndpoint(Endpoint):
    def get(self, request, team_id):
        team = Team.objects.get_from_cache(id=team_id)

        assert_perm(team, request.user, request.auth)

        data = sorted(AccessGroup.objects.filter(team=team), key=lambda x: x.name)

        return Response(serialize(data, request.user))

    def post(self, request, team_id):
        team = Team.objects.get_from_cache(id=team_id)

        assert_perm(team, request.user, request.auth, access=MEMBER_ADMIN)

        serializer = AccessGroupSerializer(data=request.DATA)

        if serializer.is_valid():
            access_group = serializer.object
            access_group.team = team
            access_group.managed = False
            access_group.save()
            return Response(serialize(access_group, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
