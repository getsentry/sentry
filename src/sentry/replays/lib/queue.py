import collections
import concurrent.futures as cf
import functools
import logging
import time
from collections.abc import Callable
from queue import Empty, Full, Queue, ShutDown
from typing import ParamSpec

logger = logging.getLogger()


P = ParamSpec("P")


def exit_on_queue_shutdown(fn: Callable[P, None]):
    @functools.wraps(fn)
    def decorator[T, U](
        inbox: Queue[T],
        outbox: Queue[U],
        errors: Queue[Exception],
        func: Callable[[T], U],
        *args: P.args,
        **kwargs: P.kwargs,
    ):
        try:
            return fn(inbox, outbox, func, *args, **kwargs)
        except ShutDown:
            logger.debug("Exiting due to queue shutdown", extra={"function": func.__name__})
            return None
        except Exception as exc:
            # Unhandled exceptions terminate the thread. That should be unsuprising. We propagate
            # the exception to the parent thread via the errors queue. The parent thread should
            # unwind the consumer. An unhandled crash has occurred so the consumer process needs
            # to be terminated or otherwise restarted.
            errors.put(exc)
            return None

    return decorator


@exit_on_queue_shutdown
def do[T, U](
    inbox: Queue[T],
    outbox: Queue[U],
    fn: Callable[[T], U],
) -> None:
    """
    This is a blocking function. It must be executed within a thread.
    """
    while True:
        try:
            # Queue access is bounded with a timeout because we don't want the order of queue
            # shutdowns to influence when this process should exit. If, for example, outbox was
            # permanently full and the process was blocked it would require the parent thread
            # calling outbox.shutdown() for this thread to exit but if the parent thread waits for
            # this thread to exit before proceeding to shutdown the outbox queue then this thread
            # will never terminate! This condition could happen if the executor shuts down the
            # inbox queue and then waits for the thread to drain prior to shutting down the outbox
            # queue. In fact, we might expect that to be the ideal shutdown process!
            #
            # Its also generally a good idea to always bound your operations regardless of the
            # immediate need.
            outbox.put(fn(inbox.get(timeout=0.01)), timeout=0.01)
        except (Empty, Full):
            continue


@exit_on_queue_shutdown
def do_threaded[T, U](
    inbox: Queue[T],
    outbox: Queue[U],
    fn: Callable[[T], U],
    max_workers: int,
) -> None:
    """
    This is a blocking function. It must be executed within a thread.
    """
    # This is our futures queue where we track futures by order of arrival. We want to emit these
    # futures to the next-step in order so its critical to track the futures in this way.
    fs: collections.deque[cf.Future[U]] = collections.deque()

    with cf.ThreadPoolExecutor(max_workers=max_workers) as p:
        while True:
            # We need to check if the outbox was shutdown because its not guaranteed we will ever
            # call the `put` method on the outbox queue! By checking manually (and bounding all of
            # our operations) we force this thread to exit if either outbox has been shutdown.
            #
            # The inbox queue could similarly be perpetually ignored if the futures queue is full
            # and can never be drained. We need to check for the shutdown signal so this thread
            # can be forced to exit.
            if inbox.is_shutdown or outbox.is_shutdown:
                raise ShutDown

            # If our futures queue has available space we'll pull from the inbox queue and push
            # the message into the pool. If the futures queue is empty then we'll wait forever. If
            # the inbox queue is shutdown then this function will terminate.
            try:
                if len(fs) < max_workers:
                    fs.append(p.submit(fn, inbox.get(timeout=0.01)))
            except Empty:
                # An empty queue is fine. Let's move on to the next step.
                pass

            # If we have a full futures queue and the first item in the queue is not done then
            # this function becomes a hot loop. To prevent us from spinning we add a short sleep to
            # throttle the thread and give an opportunitiy for other threads to make progress.
            #
            # After sleeping we'll fall-through and attempt to drain the futures. If we can't
            # that's okay we'll jump back to here and sleep again.
            if len(fs) >= max_workers and not fs[0].done():
                time.sleep(0.01)

            # Remove all the done futures and push them to the outbox. If output was closed this
            # will raise a ShutDown exception and terminate the process.
            while fs and fs[0].done():
                try:
                    outbox.put(fs[0].result(), timeout=0.01)
                    fs.popleft()
                except Full:
                    continue
