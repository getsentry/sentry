from Queue import Queue
from sentry.client.base import SentryClient
from threading import Thread

class SentryAsyncClient(SentryClient):
    """This client uses a single background thread to dispatch errors."""
    _terminator = object()

    def __init__(self):
        """Starts the task thread."""
        self.queue = Queue(-1)
        self.running = True
        self._thread = Thread(target=self._target)
        self._thread.setDaemon(True)
        self._thread.start()

    def stop(self):
        """Stops the task thread. Synchronous!"""
        if self.running:
            self.queue.put_nowait(self._terminator)
            self._thread.join()
            self._thread = None

    def _target(self):
        while 1:
            record = self.queue.get()
            if record is self._terminator:
                self.running = False
                break
            self.send_remote_sync(**record)

    def send_remote_sync(self, **kwargs):
        super(SentryAsyncClient, self).send_remote(**kwargs)

    def send_remote(self, **kwargs):
        self.queue.put_nowait(kwargs)
