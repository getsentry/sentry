import logging
from random import randint
from typing import Any, Callable, List

from celery.schedules import crontab

logger = logging.getLogger(__name__)


def crontab_with_minute_jitter(*args, **kwargs):
    kwargs["minute"] = randint(0, 59)
    return crontab(*args, **kwargs)


_celery_shutdown_handlers: List[Callable[[], None]] = []


def run_shutdown(*args, **kwargs):
    for handler in _celery_shutdown_handlers:
        try:
            handler()
        except Exception:
            logger.warning("celery.shutdown.failed", exc_info=True)


def register_shutdown(func: Callable[[], Any]) -> None:
    """
    Register a callback to be run when celery subprocess shuts down. This is
    not 100% failsafe (in case the Celery task OOMs, experiences hard-timeouts
    or segfaults) but makes it relatively easy to produce to Kafka from celery
    tasks, reuse the producer across tasks and only flush the batch when the
    worker subprocess is being shut down (see max_tasks_per_child)

    The Sentry Python SDK has a more robust and battle-tested variant of this
    in its Celery integration, but that one is more complicated as it is
    supposed to work under Celery 3.
    """

    _celery_shutdown_handlers.append(func)
