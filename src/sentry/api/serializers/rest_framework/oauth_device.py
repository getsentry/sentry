from typing import Any, TypedDict

from rest_framework import serializers

from sentry.api.helpers.oauth_device import normalize_user_code


class OAuthUserCodeField(serializers.CharField):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(max_length=32, **kwargs)

    def to_internal_value(self, data: Any) -> str:
        return normalize_user_code(super().to_internal_value(data))


class OAuthDeviceQuery(TypedDict):
    user_code: str


class OAuthDeviceQuerySerializer(serializers.Serializer[OAuthDeviceQuery]):
    user_code = OAuthUserCodeField()


class OAuthDeviceContextQuerySerializer(OAuthDeviceQuerySerializer):
    user_code = OAuthUserCodeField(required=False, allow_blank=True, default="")
