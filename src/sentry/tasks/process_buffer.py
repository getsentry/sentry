from __future__ import absolute_import

import logging

from sentry.tasks.base import instrumented_task
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.process_buffer.process_pending", queue="buffers.process_pending"
)
def process_pending(partition=None):
    """
    Process pending buffers.
    """
    from sentry import buffer
    from sentry.app import locks

    if partition is None:
        lock_key = "buffer:process_pending"
    else:
        lock_key = "buffer:process_pending:%d" % partition

    lock = locks.get(lock_key, duration=60)

    try:
        with lock.acquire():
            buffer.process_pending(partition=partition)
    except UnableToAcquireLock as error:
        logger.warning("process_pending.fail", extra={"error": error, "partition": partition})


@instrumented_task(name="sentry.tasks.process_buffer.process_incr")
def process_incr(**kwargs):
    """
    Processes a buffer event.
    """
    from sentry import buffer

    buffer.process(**kwargs)
