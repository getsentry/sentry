"""
sentry.middleware.sudo
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.utils.sudo import has_sudo_privileges


class SudoMiddleware(object):
    def process_request(self, request):
        request.is_sudo = lambda: has_sudo_privileges(request)
