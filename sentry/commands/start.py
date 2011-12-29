"""
sentry.commands.start
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.commands.utils import options, opt


class SentryWorker(object):
    def __init__(self, **kwargs):
        pass

    def execute(self, command):
        assert command in ('start',)

        getattr(self, command)()

    def start(self):
        from sentry.queue.client import broker
        from sentry.queue.worker import Worker

        from kombu.utils.debug import setup_logging
        setup_logging(loglevel="INFO")

        try:
            Worker(broker.connection).run()
        except KeyboardInterrupt:
            print("bye bye")


@options(
    opt('--background', action='store_true', default=False, dest='daemonize'),
    opt('--foreground', action='store_false', default=False, dest='daemonize'),
    opt('--debug', action='store_true', default=False, dest='debug'),
    opt('--service', dest='service', default='http', choices=['http', 'worker']),
)
def start(daemonize=False, debug=False, service='http'):
    from sentry.utils import server
    app_class = {
        'http': server.SentryHTTPServer,
        'worker': SentryWorker,
    }[service]

    # TODO: daemonize should generically daemonize any subproc
    app = app_class(
        daemonize=daemonize,
        debug=debug,
    )
    app.execute('start')
