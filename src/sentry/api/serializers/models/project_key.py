from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, Any, NotRequired, TypedDict, cast

from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import Url, absolute_url
from sentry.auth.superuser import is_active_superuser
from sentry.loader.browsersdkversion import (
    get_browser_sdk_version_choices,
    get_selected_browser_sdk_version,
)
from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption, get_dynamic_sdk_loader_option
from sentry.models.projectkey import ProjectKey
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class RateLimit(TypedDict):
    window: Annotated[int, ApiDescription("Rate limit window in seconds")]
    count: Annotated[int, ApiDescription("Number of events accepted per window")]


class DSN(TypedDict):
    secret: Annotated[Url, ApiDescription("DSN that includes the secret key")]
    public: Annotated[Url, ApiDescription("Public DSN to configure SDKs with")]
    csp: Annotated[Url, ApiDescription("Endpoint for Content Security Policy reports")]
    security: Annotated[Url, ApiDescription("Endpoint for security reports")]
    minidump: Annotated[Url, ApiDescription("Endpoint for minidump crash reports")]
    nel: Annotated[Url, ApiDescription("Endpoint for Network Error Logging reports")]
    unreal: Annotated[Url, ApiDescription("Endpoint for Unreal Engine crash reports")]
    crons: Annotated[Url, ApiDescription("Endpoint for cron monitor check-ins")]
    cdn: Annotated[Url, ApiDescription("URL of the JavaScript SDK Loader script")]
    playstation: Annotated[Url, ApiDescription("Endpoint for PlayStation crash reports")]
    integration: Annotated[
        Url,
        ApiDescription("Base URL for integration endpoints, such as the OpenTelemetry endpoints"),
    ]
    otlp_traces: Annotated[Url, ApiDescription("OpenTelemetry (OTLP) endpoint for traces")]
    otlp_logs: Annotated[Url, ApiDescription("OpenTelemetry (OTLP) endpoint for logs")]


class BrowserSDK(TypedDict):
    choices: Annotated[
        list[list[str]],
        ApiDescription("JavaScript SDK versions the Loader can serve, as [value, label] pairs"),
    ]


class DynamicSDKLoaderOptions(TypedDict):
    hasReplay: Annotated[bool, ApiDescription("Whether the Loader enables Session Replay")]
    hasPerformance: Annotated[bool, ApiDescription("Whether the Loader enables tracing")]
    hasDebug: Annotated[bool, ApiDescription("Whether the Loader loads the debug bundle")]
    hasFeedback: Annotated[bool, ApiDescription("Whether the Loader enables User Feedback")]
    hasLogsAndMetrics: Annotated[
        bool, ApiDescription("Whether the Loader enables logs and metrics")
    ]


class ProjectKeySerializerResponse(TypedDict):
    """
    This represents a Sentry Project Client Key.
    """

    id: Annotated[str, ApiDescription("ID of the client key, same as its public key")]
    name: Annotated[str, ApiDescription("Name of the client key")]
    label: Annotated[str, ApiDescription("Name of the client key, same as name")]
    public: Annotated[str | None, ApiDescription("Public key")]
    secret: Annotated[str | None, ApiDescription("Secret key")]
    projectId: Annotated[int, ApiDescription("ID of the project the key belongs to")]
    isActive: Annotated[bool, ApiDescription("Whether the client key accepts events")]
    rateLimit: Annotated[
        RateLimit | None,
        ApiDescription("Rate limit for events sent with the key. Null when there's none"),
    ]
    dsn: Annotated[DSN, ApiDescription("DSN and ingestion endpoints for the key")]
    browserSdkVersion: Annotated[str, ApiDescription("JavaScript SDK version the Loader serves")]
    browserSdk: Annotated[
        BrowserSDK, ApiDescription("JavaScript SDK versions the Loader can serve")
    ]
    dateCreated: Annotated[
        datetime | None, ApiDescription("When the client key was created (ISO 8601)")
    ]
    dynamicSdkLoaderOptions: Annotated[
        DynamicSDKLoaderOptions, ApiDescription("Features the JavaScript SDK Loader enables")
    ]
    useCase: NotRequired[
        Annotated[
            str,
            ApiDescription(
                "What the key is used for, such as user or profiling. Only included for superusers"
            ),
        ]
    ]


@register(ProjectKey)
class ProjectKeySerializer(Serializer[ProjectKeySerializerResponse]):
    def serialize(
        self,
        obj: ProjectKey,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ProjectKeySerializerResponse:
        # obj.public_key should always be set but it isn't required in the ProjectKey model.
        # Because of this mypy complains that ProjectKeySerializerResponse attrs id, name, and label
        # must be Optional[str] instead of str. By setting else to "" we getaround this
        name = obj.label or (obj.public_key[:14] if obj.public_key else "")
        public_key = obj.public_key or ""
        data: ProjectKeySerializerResponse = {
            "id": public_key,
            "name": name,
            # label is here for compatibility
            "label": name,
            "public": public_key,
            "secret": obj.secret_key,
            "projectId": obj.project_id,
            "isActive": obj.is_active,
            "rateLimit": (
                {"window": obj.rate_limit_window, "count": obj.rate_limit_count}
                if (obj.rate_limit_window and obj.rate_limit_count)
                else None
            ),
            "dsn": {
                "secret": absolute_url(obj.dsn_private),
                "public": absolute_url(obj.dsn_public),
                "csp": absolute_url(obj.csp_endpoint),
                "security": absolute_url(obj.security_endpoint),
                "minidump": absolute_url(obj.minidump_endpoint),
                "nel": absolute_url(obj.nel_endpoint),
                "unreal": absolute_url(obj.unreal_endpoint),
                "crons": absolute_url(obj.crons_endpoint),
                "cdn": absolute_url(obj.js_sdk_loader_cdn_url),
                "playstation": absolute_url(obj.playstation_endpoint),
                "integration": absolute_url(obj.integration_endpoint),
                "otlp_traces": absolute_url(obj.otlp_traces_endpoint),
                "otlp_logs": absolute_url(obj.otlp_logs_endpoint),
            },
            "browserSdkVersion": get_selected_browser_sdk_version(obj),
            "browserSdk": {"choices": cast(Any, get_browser_sdk_version_choices(obj.project))},
            "dateCreated": obj.date_added,
            "dynamicSdkLoaderOptions": {
                "hasReplay": get_dynamic_sdk_loader_option(obj, DynamicSdkLoaderOption.HAS_REPLAY),
                "hasPerformance": get_dynamic_sdk_loader_option(
                    obj, DynamicSdkLoaderOption.HAS_PERFORMANCE
                ),
                "hasDebug": get_dynamic_sdk_loader_option(obj, DynamicSdkLoaderOption.HAS_DEBUG),
                "hasFeedback": get_dynamic_sdk_loader_option(
                    obj, DynamicSdkLoaderOption.HAS_FEEDBACK
                ),
                "hasLogsAndMetrics": get_dynamic_sdk_loader_option(
                    obj, DynamicSdkLoaderOption.HAS_LOGS_AND_METRICS
                ),
            },
        }

        request = cast(Request, kwargs.get("request"))
        if request and is_active_superuser(request):
            data["useCase"] = obj.use_case

        return data
