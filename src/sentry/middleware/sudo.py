"""
sentry.middleware.sudo
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from sudo.middleware import SudoMiddleware as BaseSudoMiddleware

from sentry.constants import EMPTY_PASSWORD_VALUES


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request):
        # Users without a password are assumed to always have sudo powers
        user = request.user
        if user.is_authenticated() and user.password in EMPTY_PASSWORD_VALUES:
            return True

        return super(SudoMiddleware, self).has_sudo_privileges(request)
