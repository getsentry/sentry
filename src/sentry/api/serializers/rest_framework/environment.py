from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.models.environment import Environment

ValidationError = serializers.ValidationError


@extend_schema_field(str)
class EnvironmentField(
    serializers.Field[Environment | None, str | None, Environment | None, object]
):
    def to_representation(self, value: Environment | None) -> Environment | None:
        return value

    def to_internal_value(self, data: str | None) -> Environment | None:
        if data is None:
            return None
        try:
            environment = Environment.objects.get(
                organization_id=self.context["organization"].id, name=data
            )
        except Environment.DoesNotExist:
            raise ValidationError("Environment is not part of this organization")
        return environment


class EnvironmentSerializer(serializers.Serializer):
    isHidden = serializers.BooleanField(
        help_text="Specify `true` to make the environment visible or `false` to make the environment hidden."
    )


class BulkEnvironmentSerializer(serializers.Serializer):
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
