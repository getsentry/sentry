from rest_framework import serializers

from sentry.models import User
from sentry.utils.auth import find_users


class UserField(serializers.Field):
    def to_representation(self, value):
        return value.username

    def to_internal_value(self, data):
        if not data:
            return None

        if isinstance(data, int) or data.isdigit():
            try:
                return User.objects.get(id=data)
            except User.DoesNotExist:
                pass

        try:
            return find_users(data)[0]
        except IndexError:
            raise serializers.ValidationError("Unable to find user")
