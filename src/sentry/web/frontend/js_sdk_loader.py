import time

from django.conf import settings

from sentry.loader.browsersdkversion import get_browser_sdk_version
from sentry.models import Project, ProjectKey
from sentry.relay import config
from sentry.utils import metrics
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

CACHE_CONTROL = (
    "public, max-age=3600, s-maxage=60, stale-while-revalidate=315360000, stale-if-error=315360000"
)


class JavaScriptSdkLoader(BaseView):
    auth_required = False

    def _get_context(self, key):
        """Sets context information needed to render the loader"""
        if not key:
            return ({}, None, None)

        sdk_version = get_browser_sdk_version(key)
        try:
            if "%s" in settings.JS_SDK_LOADER_DEFAULT_SDK_URL:
                sdk_url = settings.JS_SDK_LOADER_DEFAULT_SDK_URL % (sdk_version,)
            else:
                sdk_url = settings.JS_SDK_LOADER_DEFAULT_SDK_URL
        except TypeError:
            sdk_url = ""  # It fails if it cannot inject the version in the string

        return (
            {
                "config": config.get_project_key_config(key),
                "jsSdkUrl": sdk_url,
                "publicKey": key.public_key,
            },
            sdk_version,
            sdk_url,
        )

    def get(self, request, public_key, minified):
        """Returns a js file that can be integrated into a website"""
        start_time = time.time()
        key = None

        try:
            key = ProjectKey.objects.get_from_cache(public_key=public_key)
        except ProjectKey.DoesNotExist:
            pass
        else:
            key.project = Project.objects.get_from_cache(id=key.project_id)

        context, sdk_version, sdk_url = self._get_context(key)

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

        response = render_to_response(tmpl, context, content_type="text/javascript")

        response["Access-Control-Allow-Origin"] = "*"
        response["Cache-Control"] = CACHE_CONTROL
        if sdk_version and key:
            response["Surrogate-Key"] = f"project/{key.project_id} sdk/{sdk_version} sdk-loader"

        ms = int((time.time() - start_time) * 1000)
        metrics.timing("js-sdk-loader.duration", ms, instance=instance)

        return response
