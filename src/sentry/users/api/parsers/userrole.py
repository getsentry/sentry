from django.conf import settings
from rest_framework import serializers


class UserRoleValidator(serializers.Serializer[None]):
    name = serializers.CharField()
    permissions = serializers.ListField(child=serializers.CharField(), required=False)

    def validate_permissions(self, value: str) -> str:
        if not value:
            return value

        for name in value:
            if name not in settings.SENTRY_USER_PERMISSIONS:
                raise serializers.ValidationError(f"'{name}' is not a known permission.")
        return value
