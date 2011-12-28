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
    opt('--service', dest='service', default='http', choices=['http']),
)
def start(daemonize=False, host=None, port=None, debug=False, pidfile=None, logfile=None, service='http'):
    from sentry.utils import server
    app_class = {
        'http': server.SentryHTTPServer,
    }[service]
    app = app_class(
        host=host,
        port=port,
        pidfile=pidfile,
        logfile=logfile,
        daemonize=daemonize,
        debug=debug,
    )
    app.execute('start')
