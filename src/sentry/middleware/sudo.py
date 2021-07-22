from sentry.utils.auth import is_user_password_usable
from sudo.middleware import SudoMiddleware as BaseSudoMiddleware


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request):
        # Users without a usable password are assumed to always have sudo powers
        user = request.user
        if user.is_authenticated and not is_user_password_usable(user):
            return True

        return super().has_sudo_privileges(request)
