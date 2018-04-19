from __future__ import absolute_import

from sentry.utils.http import absolute_uri
from django.core.urlresolvers import reverse

from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


class RelayJavaScriptLoader(BaseView):
    auth_required = False

    def get(self, request, public_key):
        context = {
            'url': absolute_uri(reverse('sentry-relay-cdn-sdk-loader', args=[public_key]))
        }
        return render_to_response('sentry/relay-loader.js', context,
                                  content_type="text/javascript")


class RelaySdkLoader(BaseView):
    auth_required = False

    def get(self, request, public_key):
        context = {
            'url': absolute_uri(reverse('sentry-relay-cdn-config', args=[public_key]))
        }
        return render_to_response('sentry/relay-sdk-loader.js', context,
                                  content_type="text/javascript")
