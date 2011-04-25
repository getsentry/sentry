from Queue import Queue
from sentry.client.base import SentryClient
from threading import Thread, Lock

class SentryAsyncClient(SentryClient):
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
                self._thread.setDaemon(False)
                self._thread.start()
        finally:
            self._lock.release()

    def stop(self):
        """Stops the task thread. Synchronous!"""
        self._lock.acquire()
        try:
            if self._thread:
                self.queue.put_nowait(self._terminator)
                self._thread.join()
                self._thread = None
        finally:
            self._lock.release()

    def _target(self):
        while 1:
            record = self.queue.get()
            if record is self._terminator:
                break
            self.send_remote_sync(**record)

    def send_remote_sync(self, **kwargs):
        super(SentryAsyncClient, self).send_remote(**kwargs)

    def send_remote(self, **kwargs):
        self.queue.put_nowait(kwargs)
