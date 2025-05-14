from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.loader.browsersdkversion import get_all_browser_sdk_version_choices
from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption
from sentry.models.projectkey import UseCase


class RateLimitSerializer(serializers.Serializer):
    """
    Applies a rate limit to cap the number of errors accepted during a given time window. To
    disable entirely set `rateLimit` to null.
    ```json
    {
        "rateLimit": {
            "window": 7200, // time in seconds
            "count": 1000 // error cap
        }
    }
    ```
    """

    count = EmptyIntegerField(min_value=0, required=False, allow_null=True)
    window = EmptyIntegerField(min_value=0, max_value=60 * 60 * 24, required=False, allow_null=True)


class DynamicSdkLoaderOptionSerializer(serializers.Serializer):
    """
    Configures multiple options for the Javascript Loader Script.
    - `Performance Monitoring`
    - `Debug Bundles & Logging`
    - `Session Replay` - Note that the loader will load the ES6 bundle instead of the ES5 bundle.
    ```json
    {
        "dynamicSdkLoaderOptions": {
            "hasReplay": true,
            "hasPerformance": true,
            "hasDebug": true
        }
    }
    ```
    """

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


@extend_schema_serializer(
    exclude_fields=[
        "public",
        "secret",
    ],
)
class ProjectKeyPostSerializer(serializers.Serializer):
    name = serializers.CharField(
        help_text="The optional name of the key. If not provided it will be automatically generated.",
        max_length=64,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    rateLimit = RateLimitSerializer(
        required=False,
    )
    public = serializers.RegexField(r"^[a-f0-9]{32}$", required=False, allow_null=True)
    secret = serializers.RegexField(r"^[a-f0-9]{32}$", required=False, allow_null=True)
    useCase = serializers.ChoiceField(
        choices=[(v.value, v.value) for v in UseCase],
        default=UseCase.USER.value,
        required=False,
    )


class ProjectKeyPutSerializer(serializers.Serializer):
    name = serializers.CharField(
        help_text="The name for the client key.",
        max_length=64,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    isActive = serializers.BooleanField(
        help_text="Activate or deactivate the client key.", required=False
    )
    rateLimit = RateLimitSerializer(
        required=False,
        allow_null=True,
    )
    browserSdkVersion = serializers.ChoiceField(
        choices=get_all_browser_sdk_version_choices(), required=False
    )
    dynamicSdkLoaderOptions = DynamicSdkLoaderOptionSerializer(
        required=False, allow_null=True, partial=True
    )
