from rest_framework import serializers

from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.loader.browsersdkversion import get_browser_sdk_version_choices


class RateLimitSerializer(serializers.Serializer):
    count = EmptyIntegerField(min_value=0, required=False, allow_null=True)
    window = EmptyIntegerField(min_value=0, max_value=60 * 60 * 24, required=False, allow_null=True)


class ProjectKeySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    public = serializers.RegexField(r"^[a-f0-9]{32}$", required=False, allow_null=True)
    secret = serializers.RegexField(r"^[a-f0-9]{32}$", required=False, allow_null=True)
    rateLimit = RateLimitSerializer(required=False, allow_null=True)
    isActive = serializers.BooleanField(required=False)
    browserSdkVersion = serializers.ChoiceField(
        choices=get_browser_sdk_version_choices(), required=False
    )
