from __future__ import annotations

import logging
from contextlib import contextmanager
from enum import Enum, unique
from typing import Generator, Optional, Tuple

from sentry.models.relocation import Relocation

logger = logging.getLogger("sentry.relocation.tasks")


# Relocation tasks are always performed in sequential order. We can leverage this to check for any
# weird out-of-order executions.
@unique
class OrderedTask(Enum):
    NONE = 0
    UPLOADING_COMPLETE = 1
    PREPROCESSING_SCAN = 2


# The file type for a relocation export tarball of any kind.
RELOCATION_FILE_TYPE = "relocation.file"

# Relocation input files are uploaded as tarballs, and chunked and stored using the normal
# `File`/`AbstractFile` mechanism, which has a hard limit of 2GiB, because we need to represent the
# offset into it as a 32-bit int. This means that the largest tarball we are able to import at this
# time is 2GiB. When validating this tarball, we will need to make a "composite object" from the
# uploaded blobs in Google Cloud Storage, which has a limit of 32 components. Thus, we get our blob
# size of the maximum overall file size (2GiB) divided by the maximum number of blobs (32): 65536MiB
# per blob.
#
# Note that the actual production file size limit, set by uwsgi, is currently 209715200 bytes, or
# ~200MB, so we should never see more than ~4 blobs in
RELOCATION_BLOB_SIZE = int((2**31) / 32)


def start_task(
    uuid: str, step: Relocation.Step, task: OrderedTask, allowed_task_attempts: int
) -> Tuple[Optional[Relocation], int]:
    """
    All tasks for relocation are done sequentially, and take the UUID of the `Relocation` model as
    the input. We can leverage this information to do some common pre-task setup.

    Returns a tuple of relocation model and the number of attempts remaining for this task.
    """

    logger_data = {"uuid": uuid}
    try:
        relocation = Relocation.objects.get(uuid=uuid)
    except Relocation.DoesNotExist as exc:
        logger.error(f"Could not locate Relocation model by UUID: {uuid}", exc_info=exc)
        return (None, 0)
    if relocation.status != Relocation.Status.IN_PROGRESS.value:
        logger.error(
            f"Relocation has already completed as `{Relocation.Status(relocation.status)}`",
            extra=logger_data,
        )
        return (None, 0)

    try:
        prev_task_name = "" if task.value == 1 else OrderedTask(task.value - 1).name
    except Exception:
        logger.error("Attempted to execute unknown relocation task", extra=logger_data)
        fail_relocation(relocation, OrderedTask.NONE)
        return (None, 0)

    logger_data["task"] = task.name
    if relocation.latest_task == task.name:
        relocation.latest_task_attempts += 1
    elif relocation.latest_task not in {prev_task_name, task.name}:
        logger.error(
            f"Task {task.name} tried to follow {relocation.latest_task} which is the wrong order",
            extra=logger_data,
        )
        fail_relocation(relocation, task)
        return (None, 0)
    else:
        relocation.latest_task = task.name
        relocation.latest_task_attempts += 1

    relocation.step = step.value
    relocation.save()

    logger.info("Task started", extra=logger_data)
    return (relocation, allowed_task_attempts - relocation.latest_task_attempts)


def fail_relocation(relocation: Relocation, task: OrderedTask, reason: str = "") -> None:
    """
    Helper function that conveniently fails a relocation celery task in such a way that the failure
    reason is recorded for the user and no further retries occur. It should be used like:

    >>> relocation = Relocation.objects.get(...)
    >>> if failure_condition:
    >>>     fail_relocation(relocation, "Some user-friendly reason why this failed.")
    >>>     return  # Always exit the task immediately upon failure

    This function is ideal for non-transient failures, where we know there is no need to retry
    because the result won't change, like invalid input data or conclusive validation results. For
    transient failures where retrying at a later time may be useful, use `retry_or_fail_relocation`
    instead.
    """

    if reason:
        relocation.failure_reason = reason

    relocation.status = Relocation.Status.FAILURE.value
    relocation.save()

    logger.info("Task failed", extra={"uuid": relocation.uuid, "task": task.name, "reason": reason})
    return


@contextmanager
def retry_task_or_fail_relocation(
    relocation: Relocation, task: OrderedTask, attempts_left: int, reason: str = ""
) -> Generator[None, None, None]:
    """
    Catches all exceptions, and does one of two things: calls into `fail_relocation` if there are no
    retry attempts forthcoming, or simply bubbles them up (thereby triggering a celery retry) if
    there are.

    This function is ideal for transient failures, like networked service lag, where retrying at a
    later time might yield a different result. For non-transient failures, use `fail_relocation`
    instead.
    """

    logger_data = {"uuid": relocation.uuid, "task": task.name, "attempts_left": attempts_left}
    try:
        yield
    except Exception as e:
        # If this is the last attempt, fail in the manner requested before reraising the exception.
        # This ensures that the database entry for this `Relocation` correctly notes it as a
        # `FAILURE`.
        if attempts_left == 0:
            fail_relocation(relocation, task, reason)
            return

        logger_data["reason"] = reason
        logger.info("Task retried", extra=logger_data)
        raise e
    else:
        logger.info("Task finished", extra=logger_data)
