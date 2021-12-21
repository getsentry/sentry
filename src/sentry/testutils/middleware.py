from rest_framework.request import Request

from sentry.middleware.sudo import SudoMiddleware as BaseSudoMiddleware


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request: Request):
        return True
