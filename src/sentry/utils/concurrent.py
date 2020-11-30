from __future__ import absolute_import

import logging
import sys
import threading
import six
import collections
import functools

from six.moves.queue import Full, PriorityQueue
from concurrent.futures import Future
from concurrent.futures._base import RUNNING, FINISHED
from time import time

from six.moves import xrange


logger = logging.getLogger(__name__)


def execute(function, daemon=True):
    future = Future()

    def run():
        if not future.set_running_or_notify_cancel():
            return

        try:
            result = function()
        except Exception as e:
            if six.PY3:
                future.set_exception(e)
            else:
                future.set_exception_info(*sys.exc_info()[1:])
        else:
            future.set_result(result)

    t = threading.Thread(target=run)
    t.daemon = daemon
    t.start()

    return future


@functools.total_ordering
class PriorityTask(collections.namedtuple("PriorityTask", "priority item")):
    def __eq__(self, b):
        return self.priority == b.priority

    def __lt__(self, b):
        return self.priority < b.priority


class TimedFuture(Future):
    def __init__(self, *args, **kwargs):
        self.__timing = [None, None]  # [started, finished/cancelled]
        super(TimedFuture, self).__init__(*args, **kwargs)

    def get_timing(self):
        """\
        Return the timing data for this future in the form ``(started, finished)``.

        The ``started`` value can be either a timestamp or ``None`` (if the
        future has not been started.) The ``finished`` value can also be either
        a timestamp or ``None`` (if the future has not been either completed or
        cancelled.)

        There are some idiosyncrasies with the way the timings are recorded:

        - The ``started`` value will generally not be ``None`` if the
          ``finished`` value is also not ``None``. However, for a future that
          was marked as cancelled and has yet to be attempted to be executed,
          the ``finished`` value may be set while the ``started`` value is
          ``None``.
        - Similarly, the ``started`` value will generally be equal to or less
          than the ``finished`` value (ignoring non-monotonic clock phenomena.)
          However, for a future was is marked as cancelled prior to execution,
          the ``finished`` time (when the future was cancelled) may be before
          the ``started`` time (when the future was attempted to be executed.)
        """
        return tuple(self.__timing)

    def set_running_or_notify_cancel(self, *args, **kwargs):
        result = super(TimedFuture, self).set_running_or_notify_cancel(*args, **kwargs)
        # This method can only be called once (the second invocation will raise
        # a ``RuntimeError``) so if we've gotten this far we can be reasonably
        # confident that the start time hasn't been set.
        self.__timing[0] = time()
        return result

    def cancel(self, *args, **kwargs):
        with self._condition:
            # Futures can only be marked as cancelled if they are neither
            # running or finished (we have to duplicate this check that is also
            # performed in the superclass to ensure the timing is set before
            # callbacks are invoked.) As long as the future is in the correct
            # state, this call is guaranteed to succeed. This method can be
            # called multiple times, but we only record the first time the
            # future was cancelled.
            if self._state not in [RUNNING, FINISHED] and self.__timing[1] is None:
                self.__timing[1] = time()
            return super(TimedFuture, self).cancel(*args, **kwargs)

    def set_result(self, *args, **kwargs):
        with self._condition:
            # This method always overwrites the result, so we always overwrite
            # the timing, even if another timing was already recorded.
            self.__timing[1] = time()
            return super(TimedFuture, self).set_result(*args, **kwargs)

    # XXX: In python2 land we use pythonfutures library, which implements the
    # set_exception_info method, we want to override that here instead of
    # set_exception if we can.
    if six.PY3:

        def set_exception(self, *args, **kwargs):
            with self._condition:
                self.__timing[1] = time()
                return super(TimedFuture, self).set_exception(*args, **kwargs)

    else:

        def set_exception_info(self, *args, **kwargs):
            # XXX: This makes the potentially unsafe assumption that
            # ``set_exception`` will always continue to call this function.
            with self._condition:
                self.__timing[1] = time()
                return super(TimedFuture, self).set_exception_info(*args, **kwargs)


class Executor(object):
    """
    This class provides an API for executing tasks in different contexts
    (immediately, or asynchronously.)

    NOTE: This is *not* compatible with the ``concurrent.futures.Executor``
    API! Rather than ``submit`` accepting the function arguments, the function
    must already have the argument values bound (via ``functools.partial`` or
    similar), and ``submit`` passes all additional arguments to ``queue.put``
    to allow controlling whether or not queue insertion should be blocking.
    """

    Future = TimedFuture

    def submit(self, callable, priority=0, block=True, timeout=None):
        """
        Enqueue a task to be executed, returning a ``TimedFuture``.

        All implementations *must* accept the ``callable`` parameter, but other
        parameters may or may not be implemented, depending on the specific
        implementation used.
        """
        raise NotImplementedError


class SynchronousExecutor(Executor):
    """
    This executor synchronously executes callables in the current thread.

    This is primarily exists to provide API compatibility with
    ``ThreadedExecutor`` for calls that do not do significant I/O.
    """

    # TODO: The ``Future`` implementation here could be replaced with a
    # lock-free future for efficiency.

    def submit(self, callable, *args, **kwargs):
        """
        Immediately execute a callable, returning a ``TimedFuture``.
        """
        future = self.Future()
        assert future.set_running_or_notify_cancel()
        try:
            result = callable()
        except Exception as e:
            if six.PY3:
                future.set_exception(e)
            else:
                future.set_exception_info(*sys.exc_info()[1:])
        else:
            future.set_result(result)
        return future


class ThreadedExecutor(Executor):
    """\
    This executor provides a method of executing callables in a threaded worker
    pool. The number of outstanding requests can be limited by the ``maxsize``
    parameter, which has the same behavior as the parameter of the same name
    for the ``PriorityQueue`` constructor.

    All threads are daemon threads and will remain alive until the main thread
    exits. Any items remaining in the queue at this point may not be executed!
    """

    def __init__(self, worker_count=1, maxsize=0):
        self.__worker_count = worker_count
        self.__workers = set([])
        self.__started = False
        self.__queue = PriorityQueue(maxsize)
        self.__lock = threading.Lock()

    def __worker(self):
        queue = self.__queue
        while True:
            priority, (function, future) = queue.get(True)
            if not future.set_running_or_notify_cancel():
                continue
            try:
                result = function()
            except Exception as e:
                if six.PY3:
                    future.set_exception(e)
                else:
                    future.set_exception_info(*sys.exc_info()[1:])
            else:
                future.set_result(result)
            queue.task_done()

    def start(self):
        with self.__lock:
            if self.__started:
                return

            for i in xrange(self.__worker_count):
                t = threading.Thread(target=self.__worker)
                t.daemon = True
                t.start()
                self.__workers.add(t)

            self.__started = True

    def submit(self, callable, priority=0, block=True, timeout=None):
        """\
        Enqueue a task to be executed, returning a ``TimedFuture``.

        Tasks can be prioritized by providing a value for the ``priority``
        argument, which follows the same specification as the standard library
        ``Queue.PriorityQueue`` (lowest valued entries are retrieved first.)

        If the worker pool has not already been started, calling this method
        will cause all of the worker threads to start running.
        """
        if not self.__started:
            self.start()

        future = self.Future()
        task = PriorityTask(priority, (callable, future))
        try:
            self.__queue.put(task, block=block, timeout=timeout)
        except Full as error:
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
            logger.warning("Error when calling callback %r: %s", callback, error, exc_info=True)

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
