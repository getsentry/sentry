"""
sentry.middleware.locale
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import pytz

from django.middleware.locale import LocaleMiddleware

from sentry.models import UserOption
from sentry.utils.safe import safe_execute


class SentryLocaleMiddleware(LocaleMiddleware):
    def process_request(self, request):
        # No locale for static media
        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        self.__is_static = request.path_info[:9] == '/_static/'
        if self.__is_static:
            return

        safe_execute(self.load_user_conf, request,
                     _with_transaction=False)

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

    def process_response(self, request, response):
        # If static bound, we don't want to run the normal process_response since this
        # adds an extra `Vary: Accept-Language`. Static files don't need this and is
        # less effective for caching.
        try:
            if self.__is_static:
                return response
        except AttributeError:
            # catch ourselves in case __is_static never got set.
            # It's possible that process_request never ran.
            pass
        return super(SentryLocaleMiddleware, self).process_response(request, response)
