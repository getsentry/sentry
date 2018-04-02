from __future__ import absolute_import

import logging
import threading
from Queue import Queue
from concurrent.futures import Future


logger = logging.getLogger(__name__)


class ThreadedExecutor(object):
    """\
    This executor provides a method of executing callables in a threaded worker
    pool. The number of outstanding requests can be limited by the ``maxsize``
    parameter, which has the same behavior as the parameter of the same name
    for the ``Queue`` constructor.

    All threads are daemon threads and will remain alive until the main thread
    exits. Any items remaining in the queue at this point may not be executed!

    NOTE: This is *not* compatible with the ``concurrent.futures.Executor``
    API! Rather than ``submit`` accepting the function arguments, the function
    must already have the argument values bound (via ``functools.partial`` or
    similar), and ``submit`` passes all additional arguments to ``queue.put``
    to allow controlling whether or not queue insertion should be blocking.
    """

    def __init__(self, worker_count=1, maxsize=0):
        self.__worker_count = worker_count
        self.__workers = set([])
        self.__started = False
        self.__queue = Queue(maxsize)

    def start(self):
        assert not self.__started

        def worker():
            queue = self.__queue
            while True:
                function, future = queue.get(True)
                if not future.set_running_or_notify_cancel():
                    continue
                try:
                    result = function()
                except Exception as error:
                    future.set_exception(error)
                else:
                    future.set_result(result)
                queue.task_done()

        for i in xrange(self.__worker_count):
            t = threading.Thread(None, worker)
            t.daemon = True
            t.start()
            self.__workers.add(t)

        self.__started = True

    def submit(self, callable, *args, **kwargs):
        """\
        Enqueue a task to be executed, returning a ``Future``.

        If the worker pool has not already been started, calling this method
        will cause all of the worker threads to start running.
        """
        if not self.__started:
            self.start()

        future = Future()
        try:
            self.__queue.put((callable, future), *args, **kwargs)
        except Queue.Full as error:
            if future.set_running_or_notify_cancel():
                future.set_exception(error)
        return future


class FutureSet(object):
    """\
    Coordinates a set of ``Future`` objects (either from
    ``concurrent.futures``, or otherwise API compatible), and allows for
    attaching a callback when all futures have completed execution.
    """

    def __init__(self, futures):
        self.__pending = set(futures)
        self.__completed = set()
        self.__callbacks = []
        self.__lock = threading.Lock()

        for future in futures:
            future.add_done_callback(self.__mark_completed)

    def __iter__(self):
        with self.__lock:
            futures = self.__pending | self.__completed
        return iter(futures)

    def __execute_callback(self, callback):
        try:
            callback(self)
        except Exception as error:
            logger.warning(
                'Error when calling callback %r: %s',
                callback, error, exc_info=True)

    def __mark_completed(self, future):
        with self.__lock:
            self.__pending.remove(future)
            self.__completed.add(future)
            remaining = len(self.__pending)

        if remaining == 0:
            for callback in self.__callbacks:
                self.__execute_callback(callback)

    def add_done_callback(self, callback):
        with self.__lock:
            remaining = len(self.__pending)
            if remaining > 0:
                self.__callbacks.append(callback)

        if remaining == 0:
            self.__execute_callback(callback)
