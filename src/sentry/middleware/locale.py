"""
sentry.middleware.locale
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import pytz

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry.app import env
from sentry.models import UserOption
from sentry.utils.safe import safe_execute


class SentryLocaleMiddleware(object):
    def process_request(self, request):
        # HACK: bootstrap some env crud if we haven't yet
        if not settings.SENTRY_URL_PREFIX:
            settings.SENTRY_URL_PREFIX = request.build_absolute_uri(reverse('sentry')).strip('/')

        # bind request to env
        env.request = request

        safe_execute(self.load_user_conf, request)

    def load_user_conf(self, request):
        if settings.MAINTENANCE:
            return

        if not request.user.is_authenticated():
            return

        language = UserOption.objects.get_value(
            user=request.user, project=None, key='language', default=None)
        if language:
            request.session['django_language'] = language

        timezone = UserOption.objects.get_value(
            user=request.user, project=None, key='timezone', default=None)
        if timezone:
            request.timezone = pytz.timezone(timezone)
