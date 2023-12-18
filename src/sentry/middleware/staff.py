from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.staff import Staff, logger


class StaffMiddleware(MiddlewareMixin):
    def process_request(self, request: Request):
        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        self.__skip_caching = request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES)

        if self.__skip_caching:
            return

        stf = Staff(request)

        request.staff = stf

        if stf.is_active:
            logger.info(
                "staff.request",
                extra={
                    "url": request.build_absolute_uri(),
                    "method": request.method,
                    "ip_address": request.META["REMOTE_ADDR"],
                    "user_id": request.user.id,
                },
            )

    def process_response(self, request: Request, response: Response) -> Response:
        try:
            if self.__skip_caching:
                return response
        except AttributeError:
            pass
        stf = getattr(request, "staff", None)
        if stf:
            stf.on_response(response)
        return response
