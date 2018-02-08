from __future__ import absolute_import, print_function

import six

from rest_framework import serializers

from sentry.models import User, Team
from sentry.utils.auth import find_users


class ActorField(serializers.WritableField):
    def to_native(self, obj):
        return obj.username

    def from_native(self, data):
        if not data:
            return None

        if data.startswith("user:"):
            data = data[5:]

        # is user id
        if isinstance(data, six.integer_types) or data.isdigit():
            try:
                return User.objects.get(id=data)
            except User.DoesNotExist:
                pass
            try:
                return find_users(data)[0]
            except IndexError:
                raise serializers.ValidationError('Unable to find user')

        # is team id
        if data.startswith("team:"):
            data = data[5:]
            try:
                return Team.objects.get(id=data)
            except Team.DoesNotExist:
                raise serializers.ValidationError('Unable to find team')

        raise serializers.ValidationError('Unknown actor input')
