from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='first_name')

    class Meta:
        model = User
        fields = ('name', 'email')


class UserDetailsEndpoint(UserEndpoint):
    def get(self, request, user):
        data = serialize(user, request.user)

        return Response(data)

    @sudo_required
    def put(self, request, user):
        serializer = UserSerializer(user, data=request.DATA, partial=True)

        if serializer.is_valid():
            user = serializer.save()
            return Response(serialize(user, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
