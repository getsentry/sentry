from sentry.middleware.sudo import SudoMiddleware as BaseSudoMiddleware


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request):
        return True
