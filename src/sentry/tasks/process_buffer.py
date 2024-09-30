import logging

import sentry_sdk
from django.apps import apps
from django.conf import settings

from sentry.tasks.base import instrumented_task
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.lock import Lock

logger = logging.getLogger(__name__)


def get_process_lock(lock_name: str) -> Lock:
    from sentry.locks import locks

    return locks.get(f"buffer:{lock_name}", duration=60, name=lock_name)


@instrumented_task(
    name="sentry.tasks.process_buffer.process_pending", queue="buffers.process_pending"
)
def process_pending() -> None:
    """
    Process pending buffers.
    """
    from sentry import buffer

    lock = get_process_lock("process_pending")

    try:
        with lock.acquire():
            buffer.process_pending()
    except UnableToAcquireLock as error:
        logger.warning("process_pending.fail", extra={"error": error})


@instrumented_task(
    name="sentry.tasks.process_buffer.process_pending_batch", queue="buffers.process_pending_batch"
)
def process_pending_batch() -> None:
    """
    Process pending buffers in a batch.
    """
    from sentry import buffer

    lock = get_process_lock("process_pending_batch")

    try:
        with lock.acquire():
            buffer.process_batch()
    except UnableToAcquireLock as error:
        logger.warning("process_pending_batch.fail", extra={"error": error})


@instrumented_task(name="sentry.tasks.process_buffer.process_incr", queue="counters-0")
def process_incr(**kwargs):
    """
    Processes a buffer event.
    """
    from sentry import buffer

    sentry_sdk.set_tag("model", kwargs.get("model", "Unknown"))

    buffer.process(**kwargs)


def buffer_incr(model, *args, **kwargs):
    """
    Call `buffer.incr` as a task on the given model, either directly or via celery depending on
    `settings.SENTRY_BUFFER_INCR_AS_CELERY_TASK`.

    See `Buffer.incr` for an explanation of the args and kwargs to pass here.
    """
    (buffer_incr_task.delay if settings.SENTRY_BUFFER_INCR_AS_CELERY_TASK else buffer_incr_task)(
        app_label=model._meta.app_label, model_name=model._meta.model_name, args=args, kwargs=kwargs
    )


@instrumented_task(
    name="sentry.tasks.process_buffer.buffer_incr_task",
    queue="buffers.incr",
)
def buffer_incr_task(app_label, model_name, args, kwargs):
    """
    Call `buffer.incr`, resolving the model first.

    `model_name` must be in form `app_label.model_name` e.g. `sentry.group`.
    """
    from sentry import buffer

    sentry_sdk.set_tag("model", model_name)

    buffer.incr(apps.get_model(app_label=app_label, model_name=model_name), *args, **kwargs)
