from __future__ import absolute_import, print_function

import six

from rest_framework import serializers

from sentry.models import User
from sentry.utils.auth import find_users


class UserField(serializers.WritableField):
    def to_native(self, obj):
        return obj.username

    def from_native(self, data):
        if not data:
            return None

        if isinstance(data, six.integer_types) or data.isdigit():
            try:
                return User.objects.get(id=data)
            except User.DoesNotExist:
                pass

        try:
            return find_users(data)[0]
        except IndexError:
            raise serializers.ValidationError('Unable to find user')
