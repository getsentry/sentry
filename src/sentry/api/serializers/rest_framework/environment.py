from typing import Any, NotRequired, TypedDict

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.models.environment import Environment

ValidationError = serializers.ValidationError


@extend_schema_field(str)
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


class EnvironmentData(TypedDict):
    isHidden: NotRequired[bool]


class EnvironmentSerializer(serializers.Serializer[Any, EnvironmentData]):
    isHidden = serializers.BooleanField(
        help_text="Specify `true` to make the environment visible or `false` to make the environment hidden."
    )


class BulkEnvironmentData(TypedDict):
    environmentNames: NotRequired[list[str]]
    isHidden: NotRequired[bool]


class BulkEnvironmentSerializer(serializers.Serializer[Any, BulkEnvironmentData]):
    environmentNames = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        allow_empty=False,
        max_length=1000,
        help_text="List of environment names to update. Maximum 1000.",
    )
    isHidden = serializers.BooleanField(
        help_text="Specify `true` to hide or `false` to show the specified environments.",
    )
