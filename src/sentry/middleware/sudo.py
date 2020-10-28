from __future__ import absolute_import

from sudo.middleware import SudoMiddleware as BaseSudoMiddleware


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request):
        # Users without a password are assumed to always have sudo powers
        user = request.user
        if user.is_authenticated() and not user.has_usable_password():
            return True

        return super(SudoMiddleware, self).has_sudo_privileges(request)
