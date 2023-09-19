import sentry_sdk
from django.conf import settings
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.middleware.locale import LocaleMiddleware
from django.utils import translation

from sentry.services.hybrid_cloud.user_option import get_option_from_list, user_option_service
from sentry.utils.safe import safe_execute


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

            safe_execute(self.load_user_conf, request, _with_transaction=False)

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

    def load_user_conf(self, request: HttpRequest) -> None:
        if not request.user.is_authenticated:
            return

        options = user_option_service.get_many(
            filter={"user_ids": [request.user.id], "keys": ["language", "timezone"]}
        )

        if language := get_option_from_list(options, key="language"):
            # TODO: django 4.x removes this from session
            request.session[translation.LANGUAGE_SESSION_KEY] = language  # type: ignore[attr-defined]

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
