from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.superuser import Superuser, logger


class SuperuserMiddleware(MiddlewareMixin):
    def process_request(self, request: Request):
        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        self.__skip_caching = request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES)

        if self.__skip_caching:
            # XXX(dcramer): support legacy is_superuser calls for unauthenticated requests
            request.is_superuser = lambda: False
            return

        su = Superuser(request)

        request.superuser = su
        request.is_superuser = lambda: request.superuser.is_active

        if su.is_active:
            logger.info(
                "superuser.request",
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
        su = getattr(request, "superuser", None)
        if su:
            su.on_response(response)
        return response
