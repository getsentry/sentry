from datetime import datetime
from typing import Any, List, Mapping, Optional

from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.loader.browsersdkversion import (
    get_browser_sdk_version_choices,
    get_selected_browser_sdk_version,
)
from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption, get_dynamic_sdk_loader_option
from sentry.models.projectkey import ProjectKey


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
    cdn: str


class BrowserSDK(TypedDict):
    choices: List[List[str]]


class DynamicSDKLoaderOptions(TypedDict):
    hasReplay: bool
    hasPerformance: bool
    hasDebug: bool


class ProjectKeySerializerResponse(TypedDict):
    """
    This represents a Sentry Project Client Key.
    """

    id: str
    name: str
    label: str
    public: Optional[str]
    secret: Optional[str]
    projectId: int
    isActive: bool
    rateLimit: Optional[RateLimit]
    dsn: DSN
    browserSdkVersion: str
    browserSdk: BrowserSDK
    dateCreated: Optional[datetime]
    dynamicSdkLoaderOptions: DynamicSDKLoaderOptions


@register(ProjectKey)
class ProjectKeySerializer(Serializer):
    def serialize(
        self, obj: ProjectKey, attrs: Mapping[str, Any], user: Any, **kwargs: Any
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
            "rateLimit": {"window": obj.rate_limit_window, "count": obj.rate_limit_count}
            if (obj.rate_limit_window and obj.rate_limit_count)
            else None,
            "dsn": {
                "secret": obj.dsn_private,
                "public": obj.dsn_public,
                "csp": obj.csp_endpoint,
                "security": obj.security_endpoint,
                "minidump": obj.minidump_endpoint,
                "nel": obj.nel_endpoint,
                "unreal": obj.unreal_endpoint,
                "cdn": obj.js_sdk_loader_cdn_url,
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
            },
        }
        return data
