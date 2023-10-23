from __future__ import annotations

from contextlib import contextmanager
from logging import Logger
from typing import Optional, Tuple

from sentry.models.relocation import Relocation

# Relocation tasks are always performed in sequential order. We can leverage this to check for any
# weird out-of-order executions.
ORDERED_TASKS = [
    "uploading_complete",
    "preprocessing_scan",
    "preprocessing_baseline_config",
    "preprocessing_colliding_users",
    "preprocessing_compose",
    "preprocessing_ready",
]

# The file type for a relocation export tarball of any kind.
RELOCATION_FILE_TYPE = "relocation.file"

# Relocation input files are uploaded as tarballs, and chunked and stored using the normal
# `File`/`AbstractFile` mechanism, which has a hard limit of 2GiB, because we need to represent the
# offset into it as a 32-bit int. This means that the largest tarball we are able to import at this
# time is 2GiB. When validating this tarball, we will need to make a "composite object" from the
# uploaded blobs in Google Cloud Storage, which has a limit of 32 components. Thus, we get our blob
# size of the maximum overall file size (2GiB) divided by the maximum number of blobs (32): 65536MiB
# per blob.
RELOCATION_BLOB_SIZE = int((2**31) / 32)


def start_task(
    uuid: str, step: Relocation.Step, task: str, allowed_task_attempts: int, logger: Logger
) -> Tuple[Optional[Relocation], int]:
    """
    All tasks for relocation are done sequentially, and take only the UUID of the `Relocation` model as the input. We can leverage this information to do some common pre-task setup.

    Returns a tuple of relocation model and the number of attempts remaining for this task.
    """

    try:
        relocation = Relocation.objects.get(uuid=uuid)
    except Relocation.DoesNotExist as exc:
        logger.error(f"[{uuid}] Could not locate Relocation model by UUID: {uuid}", exc_info=exc)
        return (None, 0)
    if relocation.status != Relocation.Status.IN_PROGRESS.value:
        logger.error(
            f"[{uuid}] Relocation has already completed as `{Relocation.Status(relocation.status)}`"
        )
        return (None, 0)
    if task not in ORDERED_TASKS:
        logger.error(f"[{uuid}] Attempted to execute unknown relocation task: {task}")
        return (fail_relocation(relocation), 0)

    prev_task = ""
    for index, task_name in enumerate(ORDERED_TASKS):
        if task_name == task:
            if index > 0:
                prev_task = ORDERED_TASKS[index - 1]
            break

    if relocation.latest_task == task:
        relocation.latest_task_attempts += 1
    elif relocation.latest_task != prev_task:
        logger.error(
            f"[{uuid}] Task {task} attempted to follow {relocation.latest_task}, which is incorrect order"
        )
        return (fail_relocation(relocation), 0)
    else:
        relocation.latest_task = task
        relocation.latest_task_attempts = 1

    relocation.step = step.value
    relocation.save()
    return (relocation, allowed_task_attempts - relocation.latest_task_attempts)


def fail_relocation(relocation: Relocation, reason: str = "") -> None:
    """
    Helper function that conveniently fails a relocation celery in task in such a way that the
    failure reason is recorded for the user and no further retries occur. It should be used like:

    >>> relocation = Relocation.objects.get(...)
    >>> if failure_condition:
    >>>     return fail_relocation(relocation, "Some user-friendly reason why this failed.")

    This function is ideal for non-transient failures, where we know there is no need to retry
    because the result won't change, like invalid input data or conclusive validation results. For
    transient failures, use `retry_or_fail_relocation` instead.
    """

    if reason:
        relocation.failure_reason = reason

    relocation.status = Relocation.Status.FAILURE.value
    relocation.save()
    return


@contextmanager
def retry_task_or_fail_relocation(
    relocation: Relocation, attempts_left: int, reason: str = ""
) -> None:
    """
    Catches all exceptions, and does one of two things: calls into `fail_relocation` if there are no retry
    attempts forthcoming, or simply bubbles them up if there are.

    This function is ideal for transient failures, like networked service lag, where retrying at a
    later time might yield a different result. For non-transient failures, use `fail_relocation` instead.
    """

    try:
        yield
    except Exception as e:
        # If this is the last attempt, fail in the manner requested before reraising the exception.
        # This ensures that the database entry for this `Relocation` correctly notes it as a
        # `FAILURE`.
        if attempts_left == 0:
            fail_relocation(relocation, reason)
        raise e
