"""
sentry.commands.restart
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


def restart():
    from sentry.utils.server import SentryServer

    app = SentryServer()
    app.execute('restart')
