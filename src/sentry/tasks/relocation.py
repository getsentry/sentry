from __future__ import annotations

import logging
from typing import Optional

from sentry.models.relocation import Relocation, RelocationFile
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils.relocation import OrderedTask, retry_task_or_fail_relocation, start_task

logger = logging.getLogger(__name__)

# Time limits for various steps in the process.
RETRY_BACKOFF = 60  # So the 1st retry is after ~1 min, 2nd after ~2 min, 3rd after ~4 min.
UPLOADING_TIME_LIMIT = 60  # This should be quick - we're just pinging the DB, then GCS.
PREPROCESSING_TIME_LIMIT = 60 * 5  # 5 minutes is plenty for all preprocessing task attempts.

# All pre and post processing tasks have the same number of retries.
MAX_FAST_TASK_RETRIES = 2
MAX_FAST_TASK_ATTEMPTS = MAX_FAST_TASK_RETRIES + 1

# Some reasonable limits on the amount of data we import - we can adjust these as needed.
MAX_ORGS_PER_RELOCATION = 20
MAX_USERS_PER_RELOCATION = 200

RELOCATION_FILES_TO_BE_VALIDATED = [
    RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA,
    RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA,
    RelocationFile.Kind.RAW_USER_DATA,
]

# Various error strings that we want to surface to users.
ERR_FILE_UPLOAD = "Internal error during file upload"


# TODO(getsentry/team-ospo#203): We should split this task in two, one for "small" imports of say
# <=10MB, and one for large imports >10MB. Then we should limit the number of daily executions of
# the latter.
@instrumented_task(
    name="sentry.relocation.uploading_complete",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=UPLOADING_TIME_LIMIT,
)
def uploading_complete(uuid: str) -> None:
    """
    Just check to ensure that uploading the (potentially very large!) backup file has completed
    before we try to do all sorts of fun stuff with it.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_task(
        uuid=uuid,
        step=Relocation.Step.UPLOADING,
        task=OrderedTask.UPLOADING_COMPLETE,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    # Pull down the `RelocationFile` associated with this `Relocation`. Fallibility is expected
    # here: we're pushing a potentially very large file with many blobs to a cloud store, so it is
    # possible (likely, even) that not all of the blobs are yet available. If this segment fails,
    # we'll just allow the Exception to bubble up and retry the task if possible.
    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.UPLOADING_COMPLETE,
        attempts_left,
        ERR_FILE_UPLOAD,
    ):
        raw_relocation_file = (
            RelocationFile.objects.filter(
                relocation=relocation,
                kind=RelocationFile.Kind.RAW_USER_DATA.value,
            )
            .select_related("file")
            .first()
        )
        fp = raw_relocation_file.file.getfile()

        with fp:
            preprocessing_scan.delay(uuid)


@instrumented_task(
    name="sentry.relocation.preprocessing_scan",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=PREPROCESSING_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_scan(uuid: str) -> None:
    # TODO(getsentry/team-ospo#203): Implement this.
    pass
