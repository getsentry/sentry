from typing import Optional, Tuple, TypedDict

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.loader.browsersdkversion import get_browser_sdk_version
from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption, get_dynamic_sdk_loader_option
from sentry.models import Project, ProjectKey
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

CACHE_CONTROL = (
    "public, max-age=3600, s-maxage=60, stale-while-revalidate=315360000, stale-if-error=315360000"
)


class SdkConfig(TypedDict):
    dsn: str


class LoaderContext(TypedDict):
    config: SdkConfig
    jsSdkUrl: Optional[str]
    publicKey: Optional[str]


class JavaScriptSdkDynamicLoader(BaseView):
    auth_required = False

    # Do not let an organization load trigger session, breaking Vary header.
    # TODO: This view should probably not be a subclass of BaseView if it doesn't actually use the
    # large amount of organization related support utilities, but that ends up being a large refactor.
    def determine_active_organization(self, request: Request, organization_slug=None) -> None:
        pass

    def _get_context(self, key: ProjectKey) -> Tuple[LoaderContext, Optional[str], Optional[str]]:
        """Sets context information needed to render the loader"""
        if not key:
            return ({}, None, None)

        sdk_version = get_browser_sdk_version(key)

        bundle_kind_modifier = self._get_bundle_kind_modifier(key)

        sdk_url = ""
        try:
            sdk_url = settings.JS_SDK_LOADER_DEFAULT_SDK_URL % (sdk_version, bundle_kind_modifier)
        except TypeError:
            sdk_url = ""  # It fails if it cannot inject the version in the string

        return (
            {
                "config": {
                    "dsn": key.dsn_public,
                    "jsSdkUrl": sdk_url,
                    "publicKey": key.public_key,
                }
            },
            sdk_version,
            sdk_url,
        )

    def _get_bundle_kind_modifier(self, key: ProjectKey) -> str:
        """Returns a string that is used to modify the bundle name"""
        bundle_kind_modifier = ""

        if get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_PERFORMANCE):
            bundle_kind_modifier += ".tracing"

        if get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_REPLAY):
            bundle_kind_modifier += ".replay"

        # TODO(abhi): Right now this loader only supports returning es6 JS bundles.
        # We may want to re-evaluate this.
        # if es5
        # bundle_kind_modifier += ".es5"

        if get_dynamic_sdk_loader_option(key, DynamicSdkLoaderOption.HAS_DEBUG):
            bundle_kind_modifier += ".debug"

        return bundle_kind_modifier

    def get(self, request: Request, public_key: str, minified: str) -> Response:
        """Returns a JS file that dynamically loads the SDK based on project settings"""
        key = None
        try:
            key = ProjectKey.objects.get_from_cache(public_key=public_key)
        except ProjectKey.DoesNotExist:
            pass
        else:
            key.project = Project.objects.get_from_cache(id=key.project_id)

        # TODO(abhi): Return more than no-op template
        tmpl = "sentry/js-sdk-loader-noop.js.tmpl"

        context, sdk_version, sdk_url = self._get_context(key)

        response = render_to_response(tmpl, context, content_type="text/javascript")

        response["Access-Control-Allow-Origin"] = "*"
        response["Cross-Origin-Resource-Policy"] = "cross-origin"
        response["Cache-Control"] = CACHE_CONTROL

        return response
