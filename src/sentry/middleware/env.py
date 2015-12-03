from __future__ import absolute_import

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry.app import env
from random import random
from sentry.options import default_store


class SentryEnvMiddleware(object):
    def process_request(self, request):
        # HACK: bootstrap some env crud if we haven't yet
        if not settings.SENTRY_URL_PREFIX:
            settings.SENTRY_URL_PREFIX = request.build_absolute_uri(reverse('sentry')).strip('/')

        # bind request to env
        env.request = request

        # Periodically for an expire the local OptionsStore cache.
        # This cleanup is purely to keep memory low and garbage collect
        # old values. It's not required to run to keep things consistent.
        # Internally, if an option is fetched and it's expired, it gets
        # evicted immediately. This is purely for options that haven't
        # been fetched since they've expired.
        if random() < 0.25:
            default_store.expire_local_cache()
