from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.decorators import sudo_required
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='first_name')

    class Meta:
        model = User
        fields = ('name', 'email')


class UserDetailsEndpoint(Endpoint):
    def get(self, request, user_id):
        if user_id == 'me':
            user_id = request.user.id

        user = User.objects.get(id=user_id)

        assert_perm(user, request.user, request.auth)

        data = serialize(user, request.user)

        return Response(data)

    @sudo_required
    def put(self, request, user_id):
        if user_id == 'me':
            user_id = request.user.id

        user = User.objects.get(id=user_id)

        assert_perm(user, request.user, request.auth)

        serializer = UserSerializer(user, data=request.DATA, partial=True)

        if serializer.is_valid():
            user = serializer.save()
            return Response(serialize(user, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
