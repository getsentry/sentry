"""
sentry.client.async
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from Queue import Queue
from sentry.client.base import SentryClient
from threading import Thread, Lock
import atexit
from sentry.client.models import get_client
import os
import time

SENTRY_WAIT_SECONDS = 10 

class AsyncSentryClient(SentryClient):
    """This client uses a single background thread to dispatch errors."""
    _terminator = object()

    def __init__(self):
        """Starts the task thread."""
        self.queue = Queue(-1)
        self._lock = Lock()
        self._thread = None
        self.start()

    def start(self):
        self._lock.acquire()
        try:
            if not self._thread:
                self._thread = Thread(target=self._target)
                self._thread.setDaemon(True)
                self._thread.start()
        finally:
            self._lock.release()
            atexit.register(main_thread_terminated)

    def stop(self, timeout=None):
        """Stops the task thread. Synchronous!"""
        self._lock.acquire()
        try:
            if self._thread:
                self.queue.put_nowait(self._terminator)
                self._thread.join(timeout=timeout)
                self._thread = None
        finally:
            self._lock.release()

    def _target(self):
        while 1:
            record = self.queue.get()
            if record is self._terminator:
                break
            self.send_sync(**record)

    def send_sync(self, **kwargs):
        super(AsyncSentryClient, self).send(**kwargs)

    def send(self, **kwargs):
        self.queue.put_nowait(kwargs)

def main_thread_terminated():
    client = get_client()
    if isinstance(client, AsyncSentryClient):
        size = client.queue.qsize()
        if size:
            print "Sentry attempts to send %s error messages" % size
            print "Waiting up to %s seconds" % SENTRY_WAIT_SECONDS
            if os.name == 'nt':
                print "Press Ctrl-Break to quit"
            else:
                print "Press Ctrl-C to quit"
            client.stop(timeout = SENTRY_WAIT_SECONDS)
