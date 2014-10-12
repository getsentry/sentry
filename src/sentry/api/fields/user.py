from __future__ import absolute_import, print_function

from rest_framework import serializers

from sentry.models import User


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
