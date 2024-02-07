import sentry_sdk
from django.conf import settings
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.middleware.locale import LocaleMiddleware
from django.utils import translation


class SentryLocaleMiddleware(LocaleMiddleware):
    def process_request(self, request: HttpRequest) -> None:
        with sentry_sdk.start_span(op="middleware.locale", description="process_request"):
            # No locale for static media
            # This avoids touching user session, which means we avoid
            # setting `Vary: Cookie` as a response header which will
            # break HTTP caching entirely.
            self.__skip_caching = request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES)
            if self.__skip_caching:
                return

            lang_code = request.GET.get("lang")
            # user is explicitly forcing language
            if lang_code:
                try:
                    language = translation.get_supported_language_variant(lang_code)
                except LookupError:
                    super().process_request(request)
                else:
                    translation.activate(language)
                    request.LANGUAGE_CODE = translation.get_language()
            else:
                super().process_request(request)

    def process_response(
        self, request: HttpRequest, response: HttpResponseBase
    ) -> HttpResponseBase:
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
        return super().process_response(request, response)
