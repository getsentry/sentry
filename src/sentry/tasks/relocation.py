from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from io import BytesIO
from string import Template
from typing import Any, Optional
from zipfile import ZipFile

import yaml
from celery.app.task import Task
from cryptography.fernet import Fernet
from django.db import router, transaction
from google.cloud.devtools.cloudbuild_v1 import Build
from google.cloud.devtools.cloudbuild_v1 import CloudBuildClient as CloudBuildClient

from sentry.api.serializers.rest_framework.base import camel_to_snake_case, convert_dict_key_case
from sentry.backup.dependencies import NormalizedModelName, get_model
from sentry.backup.exports import export_in_config_scope, export_in_user_scope
from sentry.backup.helpers import (
    GCPKMSDecryptor,
    GCPKMSEncryptor,
    ImportFlags,
    get_default_crypto_key_version,
    unwrap_encrypted_export_tarball,
)
from sentry.backup.imports import import_in_organization_scope
from sentry.models.files.file import File
from sentry.models.files.utils import get_relocation_storage, get_storage
from sentry.models.importchunk import ControlImportChunkReplica, RegionImportChunk
from sentry.models.lostpasswordhash import LostPasswordHash as LostPasswordHash
from sentry.models.organization import Organization
from sentry.models.relocation import (
    Relocation,
    RelocationFile,
    RelocationValidation,
    RelocationValidationAttempt,
    ValidationStatus,
)
from sentry.models.user import User
from sentry.services.hybrid_cloud.lost_password_hash import lost_password_hash_service
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.signals import relocated
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import json
from sentry.utils.db import atomic_transaction
from sentry.utils.env import gcp_project_id, log_gcp_credentials_details
from sentry.utils.relocation import (
    TASK_TO_STEP,
    LoggingPrinter,
    OrderedTask,
    create_cloudbuild_yaml,
    fail_relocation,
    get_relocations_bucket_name,
    retry_task_or_fail_relocation,
    send_relocation_update_email,
    start_relocation_task,
)

logger = logging.getLogger(__name__)

# Time limits for various steps in the process.
RETRY_BACKOFF = 60  # So the 1st retry is after ~1 min, 2nd after ~2 min, 3rd after ~4 min, etc.
FAST_TIME_LIMIT = 60
MEDIUM_TIME_LIMIT = 60 * 5
SLOW_TIME_LIMIT = 60 * 30
DEFAULT_VALIDATION_TIMEOUT = timedelta(minutes=60)

# All pre and post processing tasks have the same number of retries.
MAX_FAST_TASK_RETRIES = 2
MAX_FAST_TASK_ATTEMPTS = MAX_FAST_TASK_RETRIES + 1
MAX_VALIDATION_POLLS = 60
MAX_VALIDATION_POLL_ATTEMPTS = MAX_VALIDATION_POLLS + 1
MAX_VALIDATION_RUNS = 3

# Some reasonable limits on the amount of data we import - we can adjust these as needed.
MAX_ORGS_PER_RELOCATION = 20
MAX_USERS_PER_RELOCATION = 200

RELOCATION_FILES_TO_BE_VALIDATED = [
    RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA,
    RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA,
    RelocationFile.Kind.RAW_USER_DATA,
]

# Various error strings that we want to surface to users, grouped by step.
ERR_UPLOADING_FAILED = "Internal error during file upload."

ERR_PREPROCESSING_DECRYPTION = """Could not decrypt the imported JSON - are you sure you used the
                                  correct public key?"""
ERR_PREPROCESSING_INTERNAL = "Internal error during preprocessing."
ERR_PREPROCESSING_INVALID_JSON = "Invalid input JSON."
ERR_PREPROCESSING_INVALID_TARBALL = "The import tarball you provided was invalid."
ERR_PREPROCESSING_NO_USERS = "The provided JSON must contain at least one user."
ERR_PREPROCESSING_TOO_MANY_USERS = Template(
    f"The provided JSON must contain $count users but must not exceed the limit of {MAX_USERS_PER_RELOCATION}."
)
ERR_PREPROCESSING_NO_ORGS = "The provided JSON must contain at least one organization."
ERR_PREPROCESSING_TOO_MANY_ORGS = Template(
    f"The provided JSON must contain $count organizations, but must not exceed the limit of {MAX_ORGS_PER_RELOCATION}."
)
ERR_PREPROCESSING_MISSING_ORGS = Template(
    "The following organization slug imports were requested, but could not be found in your submitted JSON: $orgs."
)

ERR_VALIDATING_ATTEMPT_MISSING = "Internal error during validating - validation attempt missing."
ERR_VALIDATING_INSTANCE_MISSING = "Internal error during validating - validation instance missing."
ERR_VALIDATING_INTERNAL = "Internal error during validating."
ERR_VALIDATING_MAX_RUNS = "All validation attempts timed out."

ERR_IMPORTING_INTERNAL = "Internal error during importing."

ERR_POSTPROCESSING_INTERNAL = "Internal error during postprocessing."

ERR_NOTIFYING_INTERNAL = "Internal error during relocation notification."

ERR_COMPLETED_INTERNAL = "Internal error during relocation wrap-up."


# TODO(getsentry/team-ospo#216): We should split this task in two, one for "small" imports of say
# <=10MB, and one for large imports >10MB. Then we should limit the number of daily executions of
# the latter.
@instrumented_task(
    name="sentry.relocation.uploading_complete",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
)
def uploading_complete(uuid: str) -> None:
    """
    Just check to ensure that uploading the (potentially very large!) backup file has completed
    before we try to do all sorts of fun stuff with it.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
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
        ERR_UPLOADING_FAILED,
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
            preprocessing_scan.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.preprocessing_scan",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
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
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.PREPROCESSING_SCAN,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.PREPROCESSING_SCAN,
        attempts_left,
        ERR_PREPROCESSING_INTERNAL,
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
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_INVALID_TARBALL,
                )

            # Decrypt the DEK using Google KMS, and use the decrypted DEK to decrypt the encoded
            # JSON.
            with retry_task_or_fail_relocation(
                relocation,
                OrderedTask.PREPROCESSING_SCAN,
                attempts_left,
                ERR_PREPROCESSING_DECRYPTION,
            ):
                log_gcp_credentials_details(logger)
                decryptor = GCPKMSDecryptor.from_bytes(
                    json.dumps(get_default_crypto_key_version()).encode("utf-8")
                )
                plaintext_data_encryption_key = decryptor.decrypt_data_encryption_key(unwrapped)
                fernet = Fernet(plaintext_data_encryption_key)
                json_data = fernet.decrypt(unwrapped.encrypted_json_blob).decode("utf-8")

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
                    relocation, OrderedTask.PREPROCESSING_SCAN, ERR_PREPROCESSING_INVALID_JSON
                )

            # Ensure that the data is reasonable and within our set bounds before we start on the
            # next task.
            if len(usernames) == 0:
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_NO_USERS,
                )
            if len(usernames) > MAX_USERS_PER_RELOCATION:
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_TOO_MANY_USERS.substitute(count=len(usernames)),
                )
            if len(org_slugs) == 0:
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_NO_ORGS,
                )
            if len(org_slugs) > MAX_ORGS_PER_RELOCATION:
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_TOO_MANY_ORGS.substitute(count=len(org_slugs)),
                )
            missing_org_slugs = set(relocation.want_org_slugs) - set(org_slugs)
            if len(missing_org_slugs):
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_MISSING_ORGS.substitute(
                        orgs=",".join(sorted(missing_org_slugs))
                    ),
                )

            relocation.want_usernames = sorted(usernames)
            relocation.save()

            # The user's import data looks basically okay - we can use this opportunity to send a
            # "your relocation request has been accepted and is in flight, please give it a few
            # hours" email.
            send_relocation_update_email(
                relocation,
                Relocation.EmailKind.STARTED,
                {
                    "uuid": str(relocation.uuid),
                    "orgs": relocation.want_org_slugs,
                },
            )

        preprocessing_transfer.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.preprocessing_transfer",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_transfer(uuid: str) -> None:
    """
    We currently have the user's relocation data stored in the main filestore bucket, but we need to
    move it to the relocation bucket. This task handles that transfer.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.PREPROCESSING_TRANSFER,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.PREPROCESSING_TRANSFER,
        attempts_left,
        ERR_PREPROCESSING_INTERNAL,
    ):
        relocation_storage = get_relocation_storage()

        # Build the `cloudbuild.yaml` file we'll use for validation. CloudBuild requires the storage
        # source to be zipped, even if it is only a single yaml file.
        cloudbuild_yaml = BytesIO(create_cloudbuild_yaml(relocation))
        cloudbuild_zip = BytesIO()
        with ZipFile(cloudbuild_zip, "w") as zf:
            zf.writestr("cloudbuild.yaml", cloudbuild_yaml.read())

        # Save the ZIP archive to remote storage, so that we may build from it.
        cloudbuild_yaml.seek(0)
        cloudbuild_zip.seek(0)
        relocation_storage.save(f"runs/{uuid}/conf/cloudbuild.yaml", cloudbuild_yaml)
        relocation_storage.save(f"runs/{uuid}/conf/cloudbuild.zip", cloudbuild_zip)

        # Upload the `key-config.json` file we'll use to identify the correct KMS resource use
        # during validation.
        log_gcp_credentials_details(logger)
        kms_config_bytes = json.dumps(get_default_crypto_key_version()).encode("utf-8")
        relocation_storage.save(f"runs/{uuid}/in/kms-config.json", BytesIO(kms_config_bytes))

        # Now, upload the relocation data proper.
        kind = RelocationFile.Kind.RAW_USER_DATA
        raw_relocation_file = (
            RelocationFile.objects.filter(
                relocation=relocation,
                kind=kind.value,
            )
            .select_related("file")
            .prefetch_related("file__blobs")
            .first()
        )
        if raw_relocation_file is None:
            raise FileNotFoundError("User-supplied relocation data not found.")

        file: File = raw_relocation_file.file
        path = f'runs/{uuid}/in/{kind.to_filename("tar")}'

        # Copy all of the files from Django's abstract filestore into an isolated,
        # backend-specific filestore for relocation operations only.
        fp = file.getfile()
        fp.seek(0)
        relocation_storage.save(path, fp)

    preprocessing_baseline_config.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.preprocessing_baseline_config",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_baseline_config(uuid: str) -> None:
    """
    Pulls down the global config data we'll need to check for collisions and global data integrity.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.PREPROCESSING_BASELINE_CONFIG,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.PREPROCESSING_BASELINE_CONFIG,
        attempts_left,
        ERR_PREPROCESSING_INTERNAL,
    ):
        kind = RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA
        path = f'runs/{uuid}/in/{kind.to_filename("tar")}'
        relocation_storage = get_relocation_storage()

        # TODO(getsentry/team-ospo#216): A very nice optimization here is to only pull this down
        # once a day - if we've already done a relocation today, we should just copy that file
        # instead of doing this (expensive!) global export again.
        fp = BytesIO()
        log_gcp_credentials_details(logger)
        export_in_config_scope(
            fp,
            encryptor=GCPKMSEncryptor.from_crypto_key_version(get_default_crypto_key_version()),
            printer=LoggingPrinter(uuid),
        )
        fp.seek(0)
        relocation_storage.save(path, fp)

    preprocessing_colliding_users.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.preprocessing_colliding_users",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
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
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.PREPROCESSING_COLLIDING_USERS,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.PREPROCESSING_COLLIDING_USERS,
        attempts_left,
        ERR_PREPROCESSING_INTERNAL,
    ):
        kind = RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA
        path = f'runs/{uuid}/in/{kind.to_filename("tar")}'
        relocation_storage = get_relocation_storage()
        fp = BytesIO()
        log_gcp_credentials_details(logger)
        export_in_user_scope(
            fp,
            encryptor=GCPKMSEncryptor.from_crypto_key_version(get_default_crypto_key_version()),
            user_filter=set(relocation.want_usernames),
            printer=LoggingPrinter(uuid),
        )
        fp.seek(0)
        relocation_storage.save(path, fp)

    preprocessing_complete.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.preprocessing_complete",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_complete(uuid: str) -> None:
    """
    This task ensures that every file CloudBuild will need to do its work is actually present and
    available. Even if we've "finished" our uploads from the previous step, they may still not (yet)
    be available on the read side, so this final step just gives us a bit of buffer to ensure that
    this is the case.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.PREPROCESSING_COMPLETE,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.PREPROCESSING_COMPLETE,
        attempts_left,
        ERR_PREPROCESSING_INTERNAL,
    ):
        relocation_storage = get_relocation_storage()
        if not relocation_storage.exists(f"runs/{uuid}/conf/cloudbuild.yaml"):
            raise FileNotFoundError("Could not locate `cloudbuild.yaml` in relocation bucket.")
        if not relocation_storage.exists(f"runs/{uuid}/conf/cloudbuild.zip"):
            raise FileNotFoundError("Could not locate `cloudbuild.zip` in relocation bucket.")
        if not relocation_storage.exists(f"runs/{uuid}/in/kms-config.json"):
            raise FileNotFoundError("Could not locate `kms-config.json` in relocation bucket.")
        for kind in RELOCATION_FILES_TO_BE_VALIDATED:
            filename = kind.to_filename("tar")
            if not relocation_storage.exists(f"runs/{uuid}/in/{filename}"):
                raise FileNotFoundError(f"Could not locate `{filename}` in relocation bucket.")

        with atomic_transaction(
            using=(router.db_for_write(Relocation), router.db_for_write(RelocationValidation))
        ):
            relocation.step = Relocation.Step.VALIDATING.value
            relocation.save()
            RelocationValidation.objects.create(relocation=relocation)

    validating_start.apply_async(args=[uuid])


def _get_relocation_validation(
    relocation: Relocation, task: OrderedTask
) -> RelocationValidation | None:
    try:
        return RelocationValidation.objects.get(relocation=relocation)
    except RelocationValidation.DoesNotExist:
        fail_relocation(
            relocation,
            task,
            ERR_VALIDATING_INSTANCE_MISSING,
        )
        return None


def _get_relocation_validation_attempt(
    relocation: Relocation,
    relocation_validation: RelocationValidation,
    build_id: str,
    task: OrderedTask,
) -> RelocationValidationAttempt | None:
    try:
        return RelocationValidationAttempt.objects.get(
            relocation=relocation, relocation_validation=relocation_validation, build_id=build_id
        )
    except RelocationValidationAttempt.DoesNotExist:
        fail_relocation(
            relocation,
            task,
            ERR_VALIDATING_ATTEMPT_MISSING,
        )
        return None


@dataclass(frozen=True)
class NextTask:
    """
    A task, along with a series of parameters to be passed to its `.apply_async` method, allowing
    the task to be scheduled at some later point in the execution.
    """

    task: Task
    args: list[Any]
    countdown: int | None = None

    def schedule(self):
        """
        Run the `.apply_async()` call defined by this future.
        """
        self.task.apply_async(args=self.args, countdown=self.countdown)


def _update_relocation_validation_attempt(
    task: OrderedTask,
    relocation: Relocation,
    relocation_validation: RelocationValidation,
    relocation_validation_attempt: RelocationValidationAttempt,
    status: ValidationStatus,
) -> NextTask | None:
    """
    After a `RelocationValidationAttempt` resolves, make sure to update the owning
    `RelocationValidation` and `Relocation` as well.

    Returns the subsequent task that should be executed as soon as the wrapping
    `retry_task_or_fail_relocation` exits, as the last action in the currently running task.
    """

    with atomic_transaction(
        using=(
            router.db_for_write(Relocation),
            router.db_for_write(RelocationValidation),
            router.db_for_write(RelocationValidationAttempt),
        )
    ):
        # If no interesting status updates occurred, check again in a minute.
        if status == ValidationStatus.IN_PROGRESS:
            logger.info(
                "Validation polling: scheduled",
                extra={"uuid": relocation.uuid, "task": task.name},
            )
            return NextTask(
                task=validating_poll,
                args=[relocation.uuid, str(relocation_validation_attempt.build_id)],
                countdown=60,
            )

        relocation_validation_attempt.status = status.value

        # These statuses merit failing this attempt and kicking off a new
        # `RelocationValidationAttempt`, if possible.
        if status in {ValidationStatus.TIMEOUT, ValidationStatus.FAILURE}:
            if relocation_validation.attempts < MAX_VALIDATION_POLL_ATTEMPTS:
                relocation_validation_attempt.status = status.value
                relocation_validation_attempt.save()

                relocation.latest_task = OrderedTask.VALIDATING_START.name
                relocation.save()

                logger.info(
                    "Validation timed out",
                    extra={"uuid": relocation.uuid, "task": task.name},
                )

                return NextTask(task=validating_start, args=[relocation.uuid])

            # Always accept the numerically higher `ValidationStatus`, since that is a more definite
            # result.
            if relocation_validation.status < status.value:
                relocation_validation.status = status.value
                relocation_validation_attempt.save()

            transaction.on_commit(
                lambda: fail_relocation(
                    relocation, task, "Validation could not be completed. Please contact support."
                ),
                using=router.db_for_write(Relocation),
            )
            return None

        # All remaining statuses are final, so we can update the owning `RelocationValidation` now.
        assert status in {ValidationStatus.INVALID, ValidationStatus.VALID}
        relocation_validation_attempt.status = status.value
        relocation_validation_attempt.save()
        relocation_validation.status = status.value
        relocation_validation.save()

        # If we've reached a definite status, resolve both the `RelocationValidation` and this
        # constituent `RelocationValidationAttempt`.
        if status == ValidationStatus.INVALID:
            logger.info(
                "Validation result: invalid",
                extra={"uuid": relocation.uuid, "task": task.name},
            )
            transaction.on_commit(
                lambda: fail_relocation(
                    relocation,
                    task,
                    "The data you provided failed validation. Please contact support.",
                ),
                using=router.db_for_write(Relocation),
            )
            return None

        assert status == ValidationStatus.VALID
        relocation.step = Relocation.Step.IMPORTING.value
        relocation.save()

        logger.info(
            "Validation result: valid",
            extra={"uuid": relocation.uuid, "task": task.name},
        )

        return NextTask(task=importing, args=[relocation.uuid])


@instrumented_task(
    name="sentry.relocation.validating_start",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def validating_start(uuid: str) -> None:
    """
    Calls into Google CloudBuild and kicks off a validation run.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.VALIDATING_START,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    relocation_validation = _get_relocation_validation(relocation, OrderedTask.VALIDATING_START)
    if relocation_validation is None:
        return
    if relocation_validation.attempts >= MAX_VALIDATION_RUNS:
        fail_relocation(relocation, OrderedTask.VALIDATING_START, ERR_VALIDATING_MAX_RUNS)
        return

    with retry_task_or_fail_relocation(
        relocation, OrderedTask.VALIDATING_START, attempts_left, ERR_VALIDATING_INTERNAL
    ):
        cb_client = CloudBuildClient()

        def camel_to_snake_keep_underscores(value):
            match = re.search(r"(_+)$", value)
            converted = camel_to_snake_case(value)
            return converted + (match.group(0) if match else "")

        cb_yaml = create_cloudbuild_yaml(relocation)
        cb_conf = yaml.safe_load(cb_yaml)
        build = Build(
            source={
                "storage_source": {
                    "bucket": get_relocations_bucket_name(),
                    "object_": f"runs/{uuid}/conf/cloudbuild.zip",
                }
            },
            steps=convert_dict_key_case(cb_conf["steps"], camel_to_snake_keep_underscores),
            artifacts=convert_dict_key_case(cb_conf["artifacts"], camel_to_snake_keep_underscores),
            timeout=convert_dict_key_case(cb_conf["timeout"], camel_to_snake_keep_underscores),
            options=convert_dict_key_case(cb_conf["options"], camel_to_snake_keep_underscores),
        )
        response = cb_client.create_build(project_id=gcp_project_id(), build=build)

        with atomic_transaction(
            using=(
                router.db_for_write(RelocationValidation),
                router.db_for_write(RelocationValidationAttempt),
            )
        ):
            relocation_validation.attempts += 1
            relocation_validation.save()
            RelocationValidationAttempt.objects.create(
                relocation=relocation,
                relocation_validation=relocation_validation,
                build_id=response.metadata.build.id,
            )

    validating_poll.apply_async(args=[uuid, str(response.metadata.build.id)])


@instrumented_task(
    name="sentry.relocation.validating_poll",
    queue="relocation",
    max_retries=MAX_VALIDATION_POLLS,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def validating_poll(uuid: str, build_id: str) -> None:
    """
    Checks the progress of a Google CloudBuild validation run.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.VALIDATING_POLL,
        allowed_task_attempts=MAX_VALIDATION_POLL_ATTEMPTS,
    )
    if relocation is None:
        return

    relocation_validation = _get_relocation_validation(relocation, OrderedTask.VALIDATING_POLL)
    if relocation_validation is None:
        return

    relocation_validation_attempt = _get_relocation_validation_attempt(
        relocation, relocation_validation, build_id, OrderedTask.VALIDATING_POLL
    )
    if relocation_validation_attempt is None:
        return

    logger.info(
        "Validation polling: active",
        extra={
            "uuid": relocation.uuid,
            "task": OrderedTask.VALIDATING_POLL.name,
            "build_id": build_id,
        },
    )

    next_task = None
    with retry_task_or_fail_relocation(
        relocation, OrderedTask.VALIDATING_POLL, attempts_left, ERR_VALIDATING_INTERNAL
    ):
        cb_client = CloudBuildClient()
        build = cb_client.get_build(project_id=gcp_project_id(), id=str(build_id))
        date_added = (
            relocation_validation_attempt.date_added
            if relocation_validation_attempt.date_added is not None
            else datetime.fromtimestamp(0)
        )
        timeout_limit = datetime.now(tz=timezone.utc) - DEFAULT_VALIDATION_TIMEOUT

        if build.status == Build.Status.SUCCESS:
            next_task = NextTask(
                task=validating_complete,
                args=[uuid, str(build_id)],
            )
        elif build.status in {
            Build.Status.FAILURE,
            Build.Status.INTERNAL_ERROR,
            Build.Status.CANCELLED,
        }:
            next_task = _update_relocation_validation_attempt(
                OrderedTask.VALIDATING_POLL,
                relocation,
                relocation_validation,
                relocation_validation_attempt,
                ValidationStatus.FAILURE,
            )
        elif (
            build.status in {Build.Status.TIMEOUT, Build.Status.EXPIRED}
            or date_added < timeout_limit
        ):
            next_task = _update_relocation_validation_attempt(
                OrderedTask.VALIDATING_POLL,
                relocation,
                relocation_validation,
                relocation_validation_attempt,
                ValidationStatus.TIMEOUT,
            )
        else:
            next_task = _update_relocation_validation_attempt(
                OrderedTask.VALIDATING_POLL,
                relocation,
                relocation_validation,
                relocation_validation_attempt,
                ValidationStatus.IN_PROGRESS,
            )

    if next_task is not None:
        next_task.schedule()


@instrumented_task(
    name="sentry.relocation.validating_complete",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def validating_complete(uuid: str, build_id: str) -> None:
    """
    Wraps up a validation run, and reports on what we found. If this task is being called, the
    CloudBuild run as completed successfully, so we just need to figure out if there were any
    findings (failure) or not (success).

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.VALIDATING_COMPLETE,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    relocation_validation = _get_relocation_validation(relocation, OrderedTask.VALIDATING_COMPLETE)
    if relocation_validation is None:
        return

    relocation_validation_attempt = _get_relocation_validation_attempt(
        relocation, relocation_validation, build_id, OrderedTask.VALIDATING_COMPLETE
    )
    if relocation_validation_attempt is None:
        return

    next_task = None
    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.VALIDATING_COMPLETE,
        attempts_left,
        ERR_VALIDATING_INTERNAL,
    ):
        storage = get_storage()
        final_status = ValidationStatus.VALID
        (_, findings_files) = storage.listdir(f"runs/{uuid}/findings")
        for file in sorted(findings_files, reverse=True):
            # Ignore files prefixed with `artifacts-`, as these are generated by CloudBuild.
            if file.startswith("artifacts-"):
                continue

            findings_file = storage.open(f"runs/{uuid}/findings/{file}")
            with findings_file:
                findings = json.load(findings_file)
                if len(findings) > 0:
                    final_status = ValidationStatus.INVALID
                    break

        next_task = _update_relocation_validation_attempt(
            OrderedTask.VALIDATING_COMPLETE,
            relocation,
            relocation_validation,
            relocation_validation_attempt,
            final_status,
        )

    if next_task is not None:
        next_task.schedule()


@instrumented_task(
    name="sentry.relocation.importing",
    queue="relocation",
    max_retries=0,
    soft_time_limit=SLOW_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def importing(uuid: str) -> None:
    """
    Perform the import on the actual live instance we are targeting.

    This function is NOT idempotent - if an import breaks, we should just abandon it rather than
    trying it again!
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.IMPORTING,
        allowed_task_attempts=1,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.IMPORTING,
        attempts_left,
        ERR_IMPORTING_INTERNAL,
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
        relocation_data_fp = raw_relocation_file.file.getfile()
        log_gcp_credentials_details(logger)
        kms_config_fp = BytesIO(json.dumps(get_default_crypto_key_version()).encode("utf-8"))

        with relocation_data_fp, kms_config_fp:
            import_in_organization_scope(
                relocation_data_fp,
                decryptor=GCPKMSDecryptor(kms_config_fp),
                flags=ImportFlags(
                    merge_users=False, overwrite_configs=False, import_uuid=str(uuid)
                ),
                org_filter=set(relocation.want_org_slugs),
                printer=LoggingPrinter(uuid),
            )

    postprocessing.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.postprocessing",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def postprocessing(uuid: str) -> None:
    """
    Make the owner of this relocation an owner of all of the organizations we just imported.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.POSTPROCESSING,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.POSTPROCESSING,
        attempts_left,
        ERR_POSTPROCESSING_INTERNAL,
    ):
        imported_org_ids: set[int] = set()
        for chunk in RegionImportChunk.objects.filter(
            import_uuid=str(uuid), model="sentry.organization"
        ):
            imported_org_ids = imported_org_ids.union(set(chunk.inserted_map.values()))

        # Do a sanity check on pk-mapping before we go and make anyone the owner of an org they did
        # not import - are all of these orgs plausibly ones that the user requested, based on slug
        # matching?
        imported_orgs = Organization.objects.filter(id__in=imported_org_ids)
        for org in imported_orgs:
            matched_prefix = False
            for slug_prefix in relocation.want_org_slugs:
                if org.slug.startswith(slug_prefix):
                    matched_prefix = True
                    break

            # This should always be treated as an internal logic error, since we just wrote these
            # orgs, so probably there is a serious bug with pk mapping.
            assert matched_prefix is True

        # Okay, all of the new organizations specified by the import chunk seem kosher - go ahead
        # and make the owner of this import an owner of all of them.
        for org in imported_orgs:
            organization_service.add_organization_member(
                organization_id=org.id,
                default_org_role=org.default_role,
                user_id=relocation.owner_id,
                role="owner",
            )

        # Last, but certainly not least: trigger signals, so that interested subscribers in eg:
        # getsentry can do whatever postprocessing they need to. If even a single one fails, we fail
        # the entire task.
        for _, result in relocated.send_robust(sender=postprocessing, relocation_uuid=uuid):
            if isinstance(result, Exception):
                raise result

    notifying_users.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.notifying_users",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def notifying_users(uuid: str) -> None:
    """
    Send an email to all users that have been imported, telling them to claim their accounts.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.NOTIFYING_USERS,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.NOTIFYING_USERS,
        attempts_left,
        ERR_NOTIFYING_INTERNAL,
    ):
        imported_user_ids: set[int] = set()
        chunks = ControlImportChunkReplica.objects.filter(
            import_uuid=str(uuid), model="sentry.user"
        )
        for chunk in chunks:
            imported_user_ids = imported_user_ids.union(set(chunk.inserted_map.values()))

        # Do a sanity check on pk-mapping before we go and reset the passwords of random users - are
        # all of these usernames plausibly ones that were included in the import, based on username
        # prefix matching?
        imported_users = user_service.get_many(filter={"user_ids": list(imported_user_ids)})
        for user in imported_users:
            matched_prefix = False
            for username_prefix in relocation.want_usernames:
                if user.username.startswith(username_prefix):
                    matched_prefix = True
                    break

            # This should always be treated as an internal logic error, since we just wrote these
            # orgs, so probably there is a serious bug with pk mapping.
            assert matched_prefix is True

        # Okay, everything seems fine - go ahead and send those emails.
        for user in imported_users:
            hash = lost_password_hash_service.get_or_create(user_id=user.id).hash
            LostPasswordHash.send_relocate_account_email(user, hash, relocation.want_org_slugs)

        relocation.latest_unclaimed_emails_sent_at = datetime.now()
        relocation.save()

    notifying_owner.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.notifying_owner",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def notifying_owner(uuid: str) -> None:
    """
    Send an email to the creator and owner, telling them that their relocation was successful.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.NOTIFYING_OWNER,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.NOTIFYING_OWNER,
        attempts_left,
        ERR_NOTIFYING_INTERNAL,
    ):
        send_relocation_update_email(
            relocation,
            Relocation.EmailKind.SUCCEEDED,
            {
                "uuid": str(relocation.uuid),
                "orgs": relocation.want_org_slugs,
            },
        )

    completed.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.completed",
    queue="relocation",
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def completed(uuid: str) -> None:
    """
    Finish up a relocation by marking it a success.
    """

    relocation: Optional[Relocation]
    attempts_left: int
    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.COMPLETED,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.COMPLETED,
        attempts_left,
        ERR_COMPLETED_INTERNAL,
    ):
        relocation.status = Relocation.Status.SUCCESS.value
        relocation.save()


TASK_MAP: dict[OrderedTask, Task] = {
    OrderedTask.NONE: Task(),
    OrderedTask.UPLOADING_COMPLETE: uploading_complete,
    OrderedTask.PREPROCESSING_SCAN: preprocessing_scan,
    OrderedTask.PREPROCESSING_TRANSFER: preprocessing_transfer,
    OrderedTask.PREPROCESSING_BASELINE_CONFIG: preprocessing_baseline_config,
    OrderedTask.PREPROCESSING_COLLIDING_USERS: preprocessing_colliding_users,
    OrderedTask.PREPROCESSING_COMPLETE: preprocessing_complete,
    OrderedTask.VALIDATING_START: validating_start,
    OrderedTask.VALIDATING_POLL: validating_poll,
    OrderedTask.VALIDATING_COMPLETE: validating_complete,
    OrderedTask.IMPORTING: importing,
    OrderedTask.POSTPROCESSING: postprocessing,
    OrderedTask.NOTIFYING_USERS: notifying_users,
    OrderedTask.NOTIFYING_OWNER: notifying_owner,
    OrderedTask.COMPLETED: completed,
}

assert list(OrderedTask._member_map_.keys()) == [k.name for k in TASK_MAP.keys()]


def get_first_task_for_step(target_step: Relocation.Step) -> Task | None:
    min_task: OrderedTask | None = None
    for ordered_task, step in TASK_TO_STEP.items():
        if step == target_step:
            if min_task is None or ordered_task.value < min_task.value:
                min_task = ordered_task

    if min_task is None or min_task == OrderedTask.NONE:
        return None

    return TASK_MAP.get(min_task, None)
