from __future__ import absolute_import

from django.conf import settings

from sentry.relay import Config
from sentry.models import ProjectKey
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


DEFAULT_SDK_URL = 'https://s3.amazonaws.com/getsentry-cdn/@sentry/browser/0.5.2/bundle.min.js'


class RelayJavaScriptLoader(BaseView):
    auth_required = False

    def get(self, request, public_key):
        """Returns a js file that can be integrated into a website"""
        key = ProjectKey.objects.get(
            public_key=public_key
        )

        config = Config(key.project)
        context = {
            'config': config.get_project_key_config(key),
            'jsSdkUrl': key.data.get('js_sdk_url', DEFAULT_SDK_URL),
            'debug': settings.DEBUG
        }

        return render_to_response('sentry/relay-loader.js.tmpl', context,
                                  content_type="text/javascript")
