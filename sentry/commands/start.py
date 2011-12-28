"""
sentry.commands.start
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.commands.utils import options, opt


@options(
    opt('--host', metavar='HOSTNAME'),
    opt('--port', type=int, metavar='PORT'),
    opt('--daemon', action='store_true', default=False, dest='daemonize'),
    opt('--no-daemon', action='store_false', default=False, dest='daemonize'),
    opt('--debug', action='store_true', default=False, dest='debug'),
    opt('--pidfile', dest='pidfile'),
    opt('--logfile', dest='logfile'),
)
def start(daemonize=False, host=None, port=None, debug=False, pidfile=None, logfile=None):
    from sentry.utils.server import SentryServer

    app = SentryServer(
        host=host,
        port=port,
        pidfile=pidfile,
        logfile=logfile,
        daemonize=daemonize,
        debug=debug,
    )
    app.execute('start')
