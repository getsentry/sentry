from __future__ import absolute_import

from sentry.relay import Config
from sentry.models import ProjectKey
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


SDK_VERSION = '0.5.2'
DEFAULT_SDK_URL = 'https://s3.amazonaws.com/getsentry-cdn/@sentry/browser/%s/bundle.min.js' % SDK_VERSION
CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=315360000, stale-if-error=315360000'


class JavaScriptSdkLoader(BaseView):
    auth_required = False

    def get(self, request, public_key):
        """Returns a js file that can be integrated into a website"""
        key = ProjectKey.objects.get(
            public_key=public_key
        )

        minified = True
        if request.GET.get('unminified'):
            minified = False

        config = Config(key.project)
        context = {
            'config': config.get_project_key_config(key),
            'jsSdkUrl': key.data.get('js_sdk_url', DEFAULT_SDK_URL),
            'minified': minified
        }

        response = render_to_response('sentry/js-sdk-loader.js.tmpl', context,
                                      content_type="text/javascript")

        response['Cache-Control'] = CACHE_CONTROL
        response['Surrogate-Key'] = 'project/%s sdk/%s sdk-loader' % (key.project_id, SDK_VERSION)

        return response
