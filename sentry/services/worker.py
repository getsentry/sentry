"""
sentry.services.worker
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.services.base import Service


class SentryWorker(Service):
    name = 'worker'

    def run(self):
        from sentry.queue.client import broker
        from sentry.queue.worker import Worker

        from kombu.utils.debug import setup_logging
        setup_logging(loglevel="INFO")

        try:
            Worker(broker.connection).run()
        except KeyboardInterrupt:
            print("bye bye")
