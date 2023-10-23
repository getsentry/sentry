from __future__ import annotations

import logging
from io import BytesIO
from typing import Optional

from cryptography.fernet import Fernet

from sentry.backup.dependencies import NormalizedModelName, get_model
from sentry.backup.exports import export_in_config_scope, export_in_user_scope
from sentry.backup.helpers import (
    decrypt_data_encryption_key_using_gcp_kms,
    unwrap_encrypted_export_tarball,
)
from sentry.models.files.file import File
from sentry.models.organization import Organization
from sentry.models.relocation import Relocation, RelocationFile
from sentry.models.user import User
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import json
from sentry.utils.relocation import (
    RELOCATION_BLOB_SIZE,
    RELOCATION_FILE_TYPE,
    fail_relocation,
    retry_task_or_fail_relocation,
    start_task,
)

logger = logging.getLogger(__name__)

# Time limits for various steps in the process.
RETRY_BACKOFF = 60  # So the 1st retry is after ~1 min, 2nd after ~2 min, 3rd after ~4 min.
UPLOADING_TIME_LIMIT = 60  # This should be quick - we're just pining the DB, then GCS.
PREPROCESSING_TIME_LIMIT = 60 * 5  # 5 minutes is plenty for all preprocessing task attempts.

# All pre and post processing tasks have the same number of retries.
MAX_FAST_TASK_RETRIES = 3
MAX_FAST_TASK_ATTEMPTS = MAX_FAST_TASK_RETRIES + 1

# Some reasonable limits on the amount of data we import - we can adjust these as needed.
MAX_ORGS_PER_RELOCATION = 20
MAX_USERS_PER_RELOCATION = 200

# Common file names.
# TODO(getsentry/team-ospo#203): Rename to `.tar` when we enable encryption here.
BASELINE_CONFIG_FILENAME = "baseline-config.json"
COLLIDING_USERS_FILENAME = "colliding-users.json"


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
    silo_mode=SiloMode.REGION,
)
def uploading_complete(uuid: str) -> None:
    """
    Just check to ensure that uploading the (potentially very large!) backup file has completed before we try to do all sorts of fun stuff with it.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_task(
        uuid=uuid,
        step=Relocation.Step.UPLOADING,
        task="uploading_complete",
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
        logger=logger,
    )
    if relocation is None:
        return

    # Pull down the `RelocationFile` associated with this `Relocation`. Fallibility is expected
    # here: we're pushing a potentially very large file with many blobs to a cloud store, so it is
    # possible (likely, even) that not all of the blobs are yet available. If this segment fails,
    # we'll just allow the Exception to bubble up and retry the task if possible.
    with retry_task_or_fail_relocation(
        relocation, attempts_left, "Internal error during file upload"
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


# TODO(getsentry/team-ospo#203): We should split this task in two, one for "small" imports of say
# <=10MB, and one for large imports >10MB. Then we should limit the number of daily executions of
# the latter.
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
    """
    Performs the very first part of the `PREPROCESSING` step of a `Relocation`, which involves
    decrypting the user-supplied tarball and picking out some useful information for it. This let's
    us validate a few things:

        - Ensuring that the user gave us properly encrypted data (was it encrypted? With the right
          key?).
        - Ensuring that the org slug the user supplied exists in the provided JSON data.
        - Recording the slugs of the orgs the relocation is attempting to import.
        - Recording the usernames of the users the relocation is attempting to import.

    Of the preprocessing tasks, this is the most resource-onerous (what if the importer provides a
    2GB JSON blob? What if they have 20,000 usernames? Etc...) so we should take care with our retry
    logic and set careful limits.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_task(
        uuid=uuid,
        step=Relocation.Step.PREPROCESSING,
        task="preprocessing_scan",
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
        logger=logger,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation, attempts_left, "Internal error during preprocessing"
    ):
        # The `uploading_complete` task above should have verified that this is ready for use.
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
            try:
                unwrapped = unwrap_encrypted_export_tarball(fp)
            except Exception:
                return fail_relocation(relocation, "The import tarball you provided was invalid.")

            # Decrypt the DEK using Google KMS.
            # TODO(team-ospo#203): Remove hard codings.
            plaintext_data_encryption_key = decrypt_data_encryption_key_using_gcp_kms(
                unwrapped,
                """
                {
                    "project_id": "relocation-dev",
                    "location": "global",
                    "key_ring": "relocation",
                    "key": "relocation",
                    "version": "1"
                }
                """,
            )

            # Use the decrypted DEK to decrypt the encoded JSON.
            decryptor = Fernet(plaintext_data_encryption_key)
            try:
                json_data = decryptor.decrypt(unwrapped.encrypted_json_blob).decode("utf-8")
            except Exception:
                return fail_relocation(
                    relocation,
                    "Could not decrypt the imported JSON - are you sure you used the correct public key?",
                )

            # Grab usernames and org slugs from the JSON data.
            usernames = []
            org_slugs = []
            try:
                for json_model in json.loads(json_data):
                    model_name = NormalizedModelName(json_model["model"])
                    if get_model(model_name) == Organization:
                        org_slugs.append(json_model["fields"]["slug"])
                        # TODO(getsentry/team-ospo#190): Validate slug using regex, so that we can
                        # fail early on obviously invalid slugs. Also keeps the database `JSONField`
                        # from ballooning on bad input.
                    if get_model(model_name) == User:
                        usernames.append(json_model["fields"]["username"])
                        # TODO(getsentry/team-ospo#190): Validate username using regex, so that we
                        # can fail early on obviously invalid usernames. Also keeps the database
                        # `JSONField` from ballooning on bad input.
            except KeyError:
                return fail_relocation(
                    relocation,
                    "Invalid input JSON",
                )

            # Ensure that the data is reasonable and within our set bounds before we start on the
            # next task.
            if len(usernames) == 0:
                return fail_relocation(
                    relocation,
                    "The provided JSON must contain at least one user",
                )
            if len(usernames) > MAX_USERS_PER_RELOCATION:
                return fail_relocation(
                    relocation,
                    f"The provided JSON must contain {len(usernames)} users, but must not exceed the limit of {MAX_USERS_PER_RELOCATION}",
                )
            if len(org_slugs) == 0:
                return fail_relocation(
                    relocation,
                    "The provided JSON must contain at least one organization",
                )
            if len(org_slugs) > MAX_ORGS_PER_RELOCATION:
                return fail_relocation(
                    relocation,
                    f"The provided JSON must contain {len(org_slugs)} organizations, but must not exceed the limit of {MAX_ORGS_PER_RELOCATION}",
                )
            if len(org_slugs) > MAX_ORGS_PER_RELOCATION:
                return fail_relocation(
                    relocation,
                    f"The imported JSON must contain {len(org_slugs)} organizations, but must not exceed the limit of {MAX_ORGS_PER_RELOCATION}",
                )
            missing_org_slugs = set(relocation.want_org_slugs) - set(org_slugs)
            if len(missing_org_slugs):
                return fail_relocation(
                    relocation,
                    f"The following organization slug imports were requested, but could not be found in your submitted JSON: {sorted(missing_org_slugs)}",
                )

            relocation.want_usernames = sorted(usernames)
            relocation.save()

            # TODO(getsentry/team-ospo#203): The user's import data looks basically okay - we should
            # use this opportunity to send a "your relocation request has been accepted and is in
            # flight, please give it a couple hours" email.
            preprocessing_baseline_config.delay(uuid)


@instrumented_task(
    name="sentry.relocation.preprocessing_baseline_config",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=PREPROCESSING_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_baseline_config(uuid: str) -> None:
    """
    Pulls down the global config data we'll need to check for collisions and global data integrity.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_task(
        uuid=uuid,
        step=Relocation.Step.PREPROCESSING,
        task="preprocessing_baseline_config",
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
        logger=logger,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation, attempts_left, "Internal error during preprocessing"
    ):
        # TODO(getsentry/team-ospo#203): A very nice optimization here is to only pull this down
        # once a day - if we've already done a relocation today, we should just copy that file
        # instead of doing this (expensive!) global export again.
        fp = BytesIO()
        with retry_task_or_fail_relocation(relocation, attempts_left):
            # TODO(getsentry/team-ospo#203): Encrypt this!
            export_in_config_scope(fp)
            fp.seek(0)
            file = File.objects.create(name=BASELINE_CONFIG_FILENAME, type=RELOCATION_FILE_TYPE)
            file.putfile(fp, blob_size=RELOCATION_BLOB_SIZE, logger=logger)
            RelocationFile.objects.create(
                relocation=relocation,
                file=file,
                kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA.value,
            )

            preprocessing_colliding_users.delay(uuid)


@instrumented_task(
    name="sentry.relocation.preprocessing_colliding_users",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=PREPROCESSING_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_colliding_users(uuid: str) -> None:
    """
    Pulls down any already existing users whose usernames match those found in the import - we'll
    need to validate that none of these are mutated during import.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_task(
        uuid=uuid,
        step=Relocation.Step.PREPROCESSING,
        task="preprocessing_colliding_users",
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
        logger=logger,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation, attempts_left, "Internal error during preprocessing"
    ):
        fp = BytesIO()
        with retry_task_or_fail_relocation(relocation, attempts_left):
            # TODO(getsentry/team-ospo#203): Encrypt this!
            export_in_user_scope(fp, user_filter=set(relocation.want_usernames))
            fp.seek(0)
            file = File.objects.create(name=COLLIDING_USERS_FILENAME, type=RELOCATION_FILE_TYPE)
            file.putfile(fp, blob_size=RELOCATION_BLOB_SIZE, logger=logger)
            RelocationFile.objects.create(
                relocation=relocation,
                file=file,
                kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA.value,
            )

            preprocessing_compose.delay(uuid)


@instrumented_task(
    name="sentry.relocation.preprocessing_compose",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=PREPROCESSING_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_compose(uuid: str) -> None:
    """
    Creates a "composite object" from the uploaded tarball, which could have many pieces.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    # TODO(getsentry/team-ospo#203): Implement this.
    pass


@instrumented_task(
    name="sentry.relocation.preprocessing_complete",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=PREPROCESSING_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_complete(uuid: str) -> None:
    """
    Checks to ensure that all of the files we'll need for the validation step are available in our filestore.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    # TODO(getsentry/team-ospo#203): Implement this.
    pass
