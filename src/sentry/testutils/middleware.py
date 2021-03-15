from sentry.middleware.sudo import SudoMiddleware as BaseSudoMiddleware


class BrokenRequestMiddleware:
    def process_request(self, request):
        raise ImportError("request")


class BrokenResponseMiddleware:
    def process_response(self, request, response):
        raise ImportError("response")


class BrokenViewMiddleware:
    def process_view(self, request, func, args, kwargs):
        raise ImportError("view")


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request):
        return True
