from django.utils.deprecation import MiddlewareMixin

from sentry.middleware.sudo import SudoMiddleware as BaseSudoMiddleware


class BrokenRequestMiddleware(MiddlewareMixin):
    def process_request(self, request):
        raise ImportError("request")


class BrokenResponseMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        raise ImportError("response")


class BrokenViewMiddleware(MiddlewareMixin):
    def process_view(self, request, func, args, kwargs):
        raise ImportError("view")


# HACK: MiddlewareMixin is temporary, until I update diango-sudo.
class SudoMiddleware(BaseSudoMiddleware, MiddlewareMixin):
    def has_sudo_privileges(self, request):
        return True
