from rest_framework import serializers

from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.loader.browsersdkversion import get_all_browser_sdk_version_choices
from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption


class RateLimitSerializer(serializers.Serializer):
    count = EmptyIntegerField(min_value=0, required=False, allow_null=True)
    window = EmptyIntegerField(min_value=0, max_value=60 * 60 * 24, required=False, allow_null=True)


class DynamicSdkLoaderOptionSerializer(serializers.Serializer):
    hasReplay = serializers.BooleanField(required=False)
    hasPerformance = serializers.BooleanField(required=False)
    hasDebug = serializers.BooleanField(required=False)

    def to_internal_value(self, data):
        # Drop any fields that are not specified as a `DynamicSdkLoaderOption`.
        allowed = {option.value for option in DynamicSdkLoaderOption}
        existing = set(data)

        new_data = {}
        for field_name in existing.intersection(allowed):
            new_data[field_name] = data[field_name]

        return super().to_internal_value(new_data)


class ProjectKeySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    public = serializers.RegexField(r"^[a-f0-9]{32}$", required=False, allow_null=True)
    secret = serializers.RegexField(r"^[a-f0-9]{32}$", required=False, allow_null=True)
    rateLimit = RateLimitSerializer(required=False, allow_null=True)
    isActive = serializers.BooleanField(required=False)
    browserSdkVersion = serializers.ChoiceField(
        choices=get_all_browser_sdk_version_choices(), required=False
    )
    dynamicSdkLoaderOptions = DynamicSdkLoaderOptionSerializer(
        required=False, allow_null=True, partial=True
    )
