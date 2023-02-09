from rest_framework import serializers

from sentry.services.hybrid_cloud.user import APIUser, user_service
from sentry.utils.auth import find_users


class UserField(serializers.Field):
    def to_representation(self, value):
        return value.username

    def to_internal_value(self, data):
        if not data:
            return None

        if isinstance(data, int) or data.isdigit():
            user: APIUser = user_service.get_user(user_id=data)
            if user is not None:
                return user

        try:
            return find_users(data)[0]
        except IndexError:
            raise serializers.ValidationError("Unable to find user")
