from django.http.request import HttpRequest

from sentry.seer.agent_token import is_agent_auth
from sudo.middleware import SudoMiddleware as BaseSudoMiddleware


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request: HttpRequest) -> bool:
        if is_agent_auth(request.auth):
            return False

        # Right now, only password reauthentication (django-sudo) is supported,
        # so if a user doesn't have a password (for example, only has github auth)
        # then we shouldn't prompt them for the password they don't have.
        user = request.user
        if user.is_authenticated and not user.has_usable_password():
            return True

        return super().has_sudo_privileges(request)
