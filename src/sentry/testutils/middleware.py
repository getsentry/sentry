from django.http.request import HttpRequest

from sentry.middleware.sudo import SudoMiddleware as BaseSudoMiddleware


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request: HttpRequest) -> bool:
        return True
