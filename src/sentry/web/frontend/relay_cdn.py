from __future__ import absolute_import

from django.conf import settings

from sentry.relay import Config
from sentry.models import ProjectKey
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

# TODO(hazat)
DEFAULT_SDK_URL = 'https://pastebin.com/raw/ncDxxR1U'


class RelayJavaScriptLoader(BaseView):
    auth_required = False

    def get(self, request, public_key):
        key = ProjectKey.objects.get(
            public_key=public_key
        )

        config = Config(key.project, key)

        sdk_url = DEFAULT_SDK_URL
        if key.cdn_sdk_url:
            sdk_url = key.cdn_sdk_url

        context = {
            'config': config.to_dict(),
            'sdkUrl': sdk_url,
            'debug': settings.DEBUG
        }
        return render_to_response('sentry/relay-loader.js.tmpl', context,
                                  content_type="text/javascript")
