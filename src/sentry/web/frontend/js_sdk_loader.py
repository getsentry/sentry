from __future__ import absolute_import

from django.http import Http404
from django.conf import settings

from sentry.relay import config
from sentry.models import ProjectKey
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response
from sentry.loader.browsersdkversion import get_browser_sdk_version


CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=315360000, stale-if-error=315360000'


class JavaScriptSdkLoader(BaseView):
    auth_required = False

    def get(self, request, public_key, minified):
        """Returns a js file that can be integrated into a website"""
        try:
            key = ProjectKey.objects.get(
                public_key=public_key
            )
        except ProjectKey.DoesNotExist:
            raise Http404

        sdk_version = get_browser_sdk_version(key)
        sdk_url = settings.JS_SDK_LOADER_DEFAULT_SDK_URL % (sdk_version, )

        if not sdk_url:
            tmpl = 'sentry/js-sdk-loader-noop.js.tmpl'
        elif minified is not None:
            tmpl = 'sentry/js-sdk-loader.min.js.tmpl'
        else:
            tmpl = 'sentry/js-sdk-loader.js.tmpl'

        context = {
            'config': config.get_project_key_config(key),
            'jsSdkUrl': sdk_url,
            'publicKey': public_key
        }

        response = render_to_response(tmpl, context, content_type="text/javascript")

        response['Cache-Control'] = CACHE_CONTROL
        response['Surrogate-Key'] = 'project/%s sdk/%s sdk-loader' % (
            key.project_id, sdk_version)

        return response
