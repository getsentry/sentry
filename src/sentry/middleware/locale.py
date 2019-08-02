from __future__ import absolute_import

import pytz

from django.conf import settings
from django.middleware.locale import LocaleMiddleware
from django.utils.translation import _trans, LANGUAGE_SESSION_KEY

from sentry.models import UserOption
from sentry.utils.safe import safe_execute


class SentryLocaleMiddleware(LocaleMiddleware):
    def process_request(self, request):
        # No locale for static media
        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        self.__skip_caching = request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES)
        if self.__skip_caching:
            return

        safe_execute(self.load_user_conf, request, _with_transaction=False)

        lang_code = request.GET.get("lang")
        # user is explicitly forcing language
        if lang_code:
            try:
                language = _trans.get_supported_language_variant(lang_code)
            except LookupError:
                super(SentryLocaleMiddleware, self).process_request(request)
            else:
                _trans.activate(language)
                request.LANGUAGE_CODE = _trans.get_language()
        else:
            super(SentryLocaleMiddleware, self).process_request(request)

    def load_user_conf(self, request):
        if not request.user.is_authenticated():
            return

        language = UserOption.objects.get_value(user=request.user, key="language")
        if language:
            request.session[LANGUAGE_SESSION_KEY] = language

        timezone = UserOption.objects.get_value(user=request.user, key="timezone")
        if timezone:
            request.timezone = pytz.timezone(timezone)

    def process_response(self, request, response):
        # If static bound, we don't want to run the normal process_response since this
        # adds an extra `Vary: Accept-Language`. Static files don't need this and is
        # less effective for caching.
        try:
            if self.__skip_caching:
                return response
        except AttributeError:
            # catch ourselves in case __skip_caching never got set.
            # It's possible that process_request never ran.
            pass
        return super(SentryLocaleMiddleware, self).process_response(request, response)
