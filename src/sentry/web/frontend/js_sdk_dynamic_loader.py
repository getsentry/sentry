from typing import Optional, Tuple, TypedDict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.loader.browsersdkversion import get_browser_sdk_version
from sentry.models import Project, ProjectKey
from sentry.web.frontend.base import BaseView


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

    def _get_bundle_kind_modifier(self) -> str:
        """Returns a string that is used to modify the bundle name"""
        bundle_kind_modifier = ""

        # if tracing
        bundle_kind_modifier += ".tracing"

        # if replay
        bundle_kind_modifier += ".replay"

        # if es5
        bundle_kind_modifier += ".es5"

        # if debug
        bundle_kind_modifier += ".debug"

        return bundle_kind_modifier

    def _get_context(self, key: str) -> Tuple[LoaderContext, Optional[str], Optional[str]]:
        """Sets context information needed to render the loader"""
        if not key:
            return ({}, None, None)

        sdk_version = get_browser_sdk_version(key)

        # TODO(abhi): Right now this loader only supports returning es6 JS bundles.
        # We may want to re-evaluate this.

        return ({}, sdk_version, None)

    def get(self, request: Request, public_key: str, minified: str) -> Response:
        """Returns a JS file that dynamically loads the SDK based on project settings"""
        key = None

        try:
            key = ProjectKey.objects.get_from_cache(public_key=public_key)
        except ProjectKey.DoesNotExist:
            pass
        else:
            key.project = Project.objects.get_from_cache(id=key.project_id)
