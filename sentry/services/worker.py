"""
sentry.services.worker
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.services.base import Service


class SentryWorker(Service):
    name = 'worker'

    def run(self):
        import eventlet
        eventlet.patcher.monkey_patch()
        from sentry.queue.client import broker
        from sentry.queue.worker import Worker

        try:
            Worker(broker.connection).run()
        except KeyboardInterrupt:
            print("bye bye")
