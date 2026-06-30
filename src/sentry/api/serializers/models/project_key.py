from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.auth.superuser import is_active_superuser
from sentry.loader.browsersdkversion import (
    get_browser_sdk_version_choices,
    get_selected_browser_sdk_version,
)
from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption, get_dynamic_sdk_loader_option
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.projectkey import ProjectKey

RELAY_DSN_ENDPOINT_OPTION = "sentry:relay_dsn_endpoint"


class RateLimit(TypedDict):
    window: int
    count: int


class DSN(TypedDict):
    secret: str
    public: str
    csp: str
    security: str
    minidump: str
    nel: str
    unreal: str
    crons: str
    cdn: str
    playstation: str
    integration: str
    otlp_traces: str
    otlp_logs: str


class BrowserSDK(TypedDict):
    choices: list[list[str]]


class DynamicSDKLoaderOptions(TypedDict):
    hasReplay: bool
    hasPerformance: bool
    hasDebug: bool
    hasFeedback: bool
    hasLogsAndMetrics: bool


class ProjectKeySerializerResponse(TypedDict):
    """
    This represents a Sentry Project Client Key.
    """

    id: str
    name: str
    label: str
    public: str | None
    secret: str | None
    projectId: int
    isActive: bool
    rateLimit: RateLimit | None
    dsn: DSN
    browserSdkVersion: str
    browserSdk: BrowserSDK
    dateCreated: datetime | None
    dynamicSdkLoaderOptions: DynamicSDKLoaderOptions
    useCase: NotRequired[str]


@register(ProjectKey)
class ProjectKeySerializer(Serializer[ProjectKeySerializerResponse]):
    def get_attrs(
        self, item_list: Sequence[ProjectKey], user: Any, **kwargs: Any
    ) -> dict[ProjectKey, dict[str, Any]]:
        project_key_org_ids: dict[int, int] = dict(
            ProjectKey.objects.filter(id__in=[item.id for item in item_list]).values_list(
                "id", "project__organization_id"
            )
        )
        relay_dsn_endpoints = OrganizationOption.objects.get_value_bulk_id(
            list(project_key_org_ids.values()), RELAY_DSN_ENDPOINT_OPTION
        )

        return {
            item: {"relay_dsn_endpoint": relay_dsn_endpoints.get(project_key_org_ids.get(item.id))}
            for item in item_list
        }

    def serialize(
        self, obj: ProjectKey, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> ProjectKeySerializerResponse:
        # obj.public_key should always be set but it isn't required in the ProjectKey model.
        # Because of this mypy complains that ProjectKeySerializerResponse attrs id, name, and label
        # must be Optional[str] instead of str. By setting else to "" we getaround this
        name = obj.label or (obj.public_key[:14] if obj.public_key else "")
        public_key = obj.public_key or ""
        relay_dsn_endpoint = attrs.get("relay_dsn_endpoint")
        endpoint_urls = obj.get_endpoint_urls(base_url=relay_dsn_endpoint)
        # The JS SDK loader is served by Sentry, not by a customer Relay — keep that URL canonical.
        canonical_endpoint_urls = obj.get_endpoint_urls() if relay_dsn_endpoint else endpoint_urls
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
                "secret": endpoint_urls.dsn_private,
                "public": endpoint_urls.dsn_public,
                "csp": endpoint_urls.csp_endpoint,
                "security": endpoint_urls.security_endpoint,
                "minidump": endpoint_urls.minidump_endpoint,
                "nel": endpoint_urls.nel_endpoint,
                "unreal": endpoint_urls.unreal_endpoint,
                "crons": endpoint_urls.crons_endpoint,
                "cdn": canonical_endpoint_urls.js_sdk_loader_cdn_url,
                "playstation": endpoint_urls.playstation_endpoint,
                "integration": endpoint_urls.integration_endpoint,
                "otlp_traces": endpoint_urls.otlp_traces_endpoint,
                "otlp_logs": endpoint_urls.otlp_logs_endpoint,
            },
            "browserSdkVersion": get_selected_browser_sdk_version(obj),
            "browserSdk": {"choices": get_browser_sdk_version_choices(obj.project)},
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

        request = kwargs.get("request")
        if request and is_active_superuser(request):
            data["useCase"] = obj.use_case

        return data
