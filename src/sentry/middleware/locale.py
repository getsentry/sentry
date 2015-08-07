"""
sentry.middleware.locale
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import pytz

from django.conf import settings
from django.middleware.locale import LocaleMiddleware

from sentry.models import UserOption
from sentry.utils.safe import safe_execute


class SentryLocaleMiddleware(LocaleMiddleware):
    def process_request(self, request):
        if settings.MAINTENANCE:
            return

        if '/api/0/' in request.path:
            return

        safe_execute(self.load_user_conf, request)

        super(SentryLocaleMiddleware, self).process_request(request)

    def load_user_conf(self, request):
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
