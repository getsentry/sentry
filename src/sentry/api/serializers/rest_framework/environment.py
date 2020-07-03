from __future__ import absolute_import

from rest_framework import serializers

from sentry.models import Environment

ValidationError = serializers.ValidationError


class EnvironmentField(serializers.Field):
    def to_representation(self, value):
        return value

    def to_internal_value(self, data):
        if data is None:
            return None
        try:
            environment = Environment.objects.get(
                organization_id=self.context["organization"].id, name=data
            )
        except Environment.DoesNotExist:
            raise ValidationError("Environment is not part of this organization")
        return environment
