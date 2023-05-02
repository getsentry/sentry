import time
from typing import Optional, Tuple, TypedDict

from django.conf import settings
from packaging.version import Version
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.loader.browsersdkversion import get_browser_sdk_version
from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption, get_dynamic_sdk_loader_option
from sentry.models import Project, ProjectKey
from sentry.utils import metrics
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

CACHE_CONTROL = (
    "public, max-age=3600, s-maxage=60, stale-while-revalidate=315360000, stale-if-error=315360000"
)


class SdkConfig(TypedDict):
    dsn: str
    tracesSampleRate: Optional[float]
    replaysSessionSampleRate: Optional[float]
    replaysOnErrorSampleRate: Optional[float]
    debug: Optional[bool]


class LoaderInternalConfig(TypedDict):
    bundleKindModifier: str
    isLazy: bool
    hasPerformance: bool
    hasReplay: bool
    hasDebug: bool


class LoaderContext(TypedDict):
    config: SdkConfig
    jsSdkUrl: Optional[str]
    publicKey: Optional[str]
    isLazy: bool


class JavaScriptSdkLoader(BaseView):
    auth_required = False

    # Do not let an organization load trigger session, breaking Vary header.
    # TODO: This view should probably not be a subclass of BaseView if it doesn't actually use the
    # large amount of organization related support utilities, but that ends up being a large refactor.
    def determine_active_organization(self, request: Request, organization_slug=None) -> None:
        pass

    def _get_loader_config(
        self, key: Optional[ProjectKey], sdk_version: Optional[str]
    ) -> LoaderInternalConfig:
        """Returns a string that is used to modify the bundle name"""

        if not key or not sdk_version:
            return {
                "bundleKindModifier": "",
                "isLazy": True,
                "hasPerformance": False,
                "hasReplay": False,
                "hasDebug": False,
            }

        is_v7_sdk = sdk_version >= Version("7.0.0")

        is_lazy = True
        bundle_kind_modifier = ""
        has_replay = get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_REPLAY)
        has_performance = get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_PERFORMANCE)
        has_debug = get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_DEBUG)

        # The order in which these modifiers are added is important, as the
        # bundle name is built up from left to right.
        # https://docs.sentry.io/platforms/javascript/install/cdn/

        # We depend on fixes in the tracing bundle that are only available in v7
        if is_v7_sdk and has_performance:
            bundle_kind_modifier += ".tracing"
            is_lazy = False

        # If the project does not have a v7 sdk set, we cannot load the replay bundle.
        if is_v7_sdk and has_replay:
            bundle_kind_modifier += ".replay"
            is_lazy = False

        # From JavaScript SDK version 7 onwards, the default bundle code is ES6, however, in the loader we
        # want to provide the ES5 version. This is why we need to modify the requested bundle name here.
        #
        # If we are loading replay, do not add the es5 modifier, as those bundles are
        # ES6 only.
        if is_v7_sdk and not has_replay:
            bundle_kind_modifier += ".es5"

        if has_debug:
            bundle_kind_modifier += ".debug"

        return {
            "bundleKindModifier": bundle_kind_modifier,
            "isLazy": is_lazy,
            "hasPerformance": has_performance,
            "hasReplay": has_replay,
            "hasDebug": has_debug,
        }

    def _get_context(
        self,
        key: Optional[ProjectKey],
        sdk_version: Optional[str],
        loader_config: LoaderInternalConfig,
    ) -> Tuple[LoaderContext, Optional[str]]:
        """Sets context information needed to render the loader"""
        if not key:
            return (
                {
                    "isLazy": True,
                },
                None,
            )

        js_sdk_loader_default_sdk_url_template_slot_count = (
            settings.JS_SDK_LOADER_DEFAULT_SDK_URL.count("%s")
        )

        try:
            if js_sdk_loader_default_sdk_url_template_slot_count == 2:
                sdk_url = settings.JS_SDK_LOADER_DEFAULT_SDK_URL % (
                    sdk_version,
                    loader_config["bundleKindModifier"],
                )
            elif js_sdk_loader_default_sdk_url_template_slot_count == 1:
                sdk_url = settings.JS_SDK_LOADER_DEFAULT_SDK_URL % (sdk_version,)
            else:
                sdk_url = settings.JS_SDK_LOADER_DEFAULT_SDK_URL
        except TypeError:
            sdk_url = ""  # It fails if it cannot inject the version in the string

        config: SdkConfig = {"dsn": key.dsn_public}

        if loader_config["hasDebug"]:
            config["debug"] = True

        if loader_config["hasPerformance"]:
            config["tracesSampleRate"] = 1

        if loader_config["hasReplay"]:
            config["replaysSessionSampleRate"] = 0.1
            config["replaysOnErrorSampleRate"] = 1

        return (
            {
                "config": config,
                "jsSdkUrl": sdk_url,
                "publicKey": key.public_key,
                "isLazy": loader_config["isLazy"],
            },
            sdk_url,
        )

    def get(self, request: Request, public_key: Optional[str], minified: Optional[str]) -> Response:
        """Returns a js file that can be integrated into a website"""
        start_time = time.time()
        key = None

        try:
            key = ProjectKey.objects.get_from_cache(public_key=public_key)
        except ProjectKey.DoesNotExist:
            pass
        else:
            key.project = Project.objects.get_from_cache(id=key.project_id)

        sdk_version = get_browser_sdk_version(key) if key else None
        loader_config = self._get_loader_config(key, sdk_version)
        context, sdk_url = self._get_context(key, sdk_version, loader_config)

        instance = "default"
        if not sdk_url:
            instance = "noop"
            tmpl = "sentry/js-sdk-loader-noop.js.tmpl"
        elif minified is not None:
            instance = "minified"
            tmpl = "sentry/js-sdk-loader.min.js.tmpl"
        else:
            tmpl = "sentry/js-sdk-loader.js.tmpl"

        metrics.incr("js-sdk-loader.rendered", instance=instance, skip_internal=False)

        analytics.record(
            "js_sdk_loader.rendered",
            organization_id=key.project.organization_id,
            project_id=key.project_id,
            is_lazy=loader_config["isLazy"],
            has_performance=loader_config["hasPerformance"],
            has_replay=loader_config["hasReplay"],
            has_debug=loader_config["hasDebug"],
            sdk_version=sdk_version,
            tmpl=tmpl,
        ) if key else None

        response = render_to_response(tmpl, context, content_type="text/javascript")

        response["Access-Control-Allow-Origin"] = "*"
        response["Cache-Control"] = CACHE_CONTROL
        if sdk_version and key:
            response["Surrogate-Key"] = f"project/{key.project_id} sdk/{sdk_version} sdk-loader"

        ms = int((time.time() - start_time) * 1000)
        metrics.timing("js-sdk-loader.duration", ms, instance=instance)

        return response
