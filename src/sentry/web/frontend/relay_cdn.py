from __future__ import absolute_import

from sentry.relay import Config
from sentry.models import ProjectKey
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


class RelayJavaScriptLoader(BaseView):
    auth_required = False

    def get(self, request, public_key):
        key = ProjectKey.objects.get(
            public_key=public_key
        )
        config = Config(key.project, key)
        context = {
            'config': config.to_dict()
        }
        return render_to_response('sentry/relay-loader.js', context,
                                  content_type="text/javascript")
