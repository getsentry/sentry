"""
sentry.commands.stop
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.commands.utils import options, opt


@options(
    opt('--pidfile', dest='pidfile'),
)
def stop(pidfile=None):
    from sentry.utils.server import SentryServer

    app = SentryServer(
        pidfile=options.pidfile,
    )
    app.execute('stop')
