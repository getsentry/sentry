from typing import Callable

from django.conf import settings
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.auth.staff import Staff, logger


class StaffMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]):
        self.get_response = get_response

    def process_request(self, request: HttpRequest) -> None:
        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        self.__skip_caching = request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES)

        if self.__skip_caching:
            return

        staff = Staff(request)

        request.staff = staff  # type: ignore[attr-defined]

        if staff.is_active:
            logger.info(
                "staff.request",
                extra={
                    "url": request.build_absolute_uri(),
                    "method": request.method,
                    "ip_address": request.META["REMOTE_ADDR"],
                    "user_id": request.user.id,
                },
            )

    def process_response(
        self, request: HttpRequest, response: HttpResponseBase
    ) -> HttpResponseBase:
        try:
            if self.__skip_caching:
                return response
        except AttributeError:
            pass
        staff = getattr(request, "staff", None)
        if staff:
            staff.on_response(response)
        return response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        self.process_request(request)
        response = self.get_response(request)
        return self.process_response(request, response)
