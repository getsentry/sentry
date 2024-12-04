from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from io import BytesIO
from string import Template
from typing import Any
from uuid import UUID
from zipfile import ZipFile

import yaml
from celery.app.task import Task
from cryptography.fernet import Fernet
from django.core.exceptions import ValidationError
from django.db import router, transaction
from google.cloud.devtools.cloudbuild_v1 import Build
from google.cloud.devtools.cloudbuild_v1 import CloudBuildClient as CloudBuildClient
from sentry_sdk import capture_exception

from sentry import analytics
from sentry.api.helpers.slugs import validate_sentry_slug
from sentry.api.serializers.rest_framework.base import camel_to_snake_case, convert_dict_key_case
from sentry.backup.crypto import (
    EncryptorDecryptorPair,
    GCPKMSDecryptor,
    GCPKMSEncryptor,
    LocalFileEncryptor,
    get_default_crypto_key_version,
    unwrap_encrypted_export_tarball,
)
from sentry.backup.dependencies import NormalizedModelName, get_model
from sentry.backup.exports import (
    export_in_config_scope,
    export_in_organization_scope,
    export_in_user_scope,
)
from sentry.backup.helpers import ImportFlags
from sentry.backup.imports import import_in_organization_scope
from sentry.hybridcloud.models.outbox import RegionOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.files.file import File
from sentry.models.files.utils import get_relocation_storage
from sentry.models.importchunk import ControlImportChunkReplica, RegionImportChunk
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.models.relocation import (
    Relocation,
    RelocationFile,
    RelocationValidation,
    RelocationValidationAttempt,
    ValidationStatus,
)
from sentry.organizations.services.organization import organization_service
from sentry.relocation.services.relocation_export.model import (
    RelocationExportReplyWithExportParameters,
)
from sentry.relocation.services.relocation_export.service import control_relocation_export_service
from sentry.signals import relocated, relocation_redeem_promo_code
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.types.region import get_local_region
from sentry.users.models.lostpasswordhash import LostPasswordHash
from sentry.users.models.user import User
from sentry.users.services.lost_password_hash import lost_password_hash_service
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.utils.db import atomic_transaction
from sentry.utils.env import gcp_project_id, log_gcp_credentials_details
from sentry.utils.relocation import (
    TASK_TO_STEP,
    LoggingPrinter,
    OrderedTask,
    StorageBackedCheckpointExporter,
    create_cloudbuild_yaml,
    fail_relocation,
    get_relocations_bucket_name,
    retry_task_or_fail_relocation,
    send_relocation_update_email,
    start_relocation_task,
    uuid_to_identifier,
)

logger = logging.getLogger(__name__)

# Time limits for various steps in the process.
RETRY_BACKOFF = 60  # So the 1st retry is after ~1 min, 2nd after ~2 min, 3rd after ~4 min, etc.
FAST_TIME_LIMIT = 60  # 1 minute
MEDIUM_TIME_LIMIT = 60 * 5  # 5 minutes
SLOW_TIME_LIMIT = 60 * 60  # 1 hour
DEFAULT_VALIDATION_TIMEOUT = timedelta(minutes=60)
CROSS_REGION_EXPORT_TIMEOUT = timedelta(minutes=60)

# All pre and post processing tasks have the same number of retries. A "fast" task is one that almost always completes in <=5 minutes, and does relatively little bulk writing to the database.
MAX_FAST_TASK_RETRIES = 3
MAX_FAST_TASK_ATTEMPTS = MAX_FAST_TASK_RETRIES + 1
MAX_SLOW_TASK_RETRIES = 4
MAX_SLOW_TASK_ATTEMPTS = MAX_SLOW_TASK_RETRIES + 1
MAX_VALIDATION_POLLS = 60
MAX_VALIDATION_POLL_ATTEMPTS = MAX_VALIDATION_POLLS + 1
MAX_VALIDATION_RUNS = 3

# Some reasonable limits on the amount of data we import - we can adjust these as needed.
MAX_ORGS_PER_RELOCATION = 20
MAX_USERS_PER_RELOCATION = 2000

RELOCATION_FILES_TO_BE_VALIDATED = [
    RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA,
    RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA,
    RelocationFile.Kind.RAW_USER_DATA,
]

# Various error strings that we want to surface to users, grouped by step.
ERR_UPLOADING_FAILED = "Internal error during file upload."
ERR_UPLOADING_NO_SAAS_TO_SAAS_ORG_SLUG = "SAAS->SAAS relocations must specify an org slug."
ERR_UPLOADING_CROSS_REGION_TIMEOUT = Template(
    "Cross-region relocation export request timed out after $delta."
)

ERR_PREPROCESSING_DECRYPTION = """Could not decrypt the imported JSON - are you sure you used the
                                  correct public key?"""
ERR_PREPROCESSING_INTERNAL = "Internal error during preprocessing."
ERR_PREPROCESSING_INVALID_JSON = "Invalid input JSON."
ERR_PREPROCESSING_INVALID_ORG_SLUG = Template(
    "You asked to import an organization with the slug $slug, which is not formatted correctly."
)
ERR_PREPROCESSING_INVALID_TARBALL = "The import tarball you provided was invalid."
ERR_PREPROCESSING_NO_USERS = "The provided JSON must contain at least one user."
ERR_PREPROCESSING_TOO_MANY_USERS = Template(
    f"The provided JSON contains $count users who are members of at least one of the organizations you specified, but must not exceed the limit of {MAX_USERS_PER_RELOCATION}."
)
ERR_PREPROCESSING_TOO_MANY_ORGS = Template(
    f"The provided JSON contains $count organizations matching one of the slugs you specified, but must not exceed the limit of {MAX_ORGS_PER_RELOCATION}."
)
ERR_PREPROCESSING_MISSING_ORGS = Template(
    "The following organization slug imports were requested, but could not be found in your submitted JSON: $orgs."
)

ERR_VALIDATING_ATTEMPT_MISSING = "Internal error while validating - validation attempt missing."
ERR_VALIDATING_INSTANCE_MISSING = "Internal error while validating - validation instance missing."
ERR_VALIDATING_INTERNAL = "Internal error while validating."
ERR_VALIDATING_MAX_RUNS = "All validation attempts timed out."

ERR_IMPORTING_INTERNAL = "Internal error while importing."

ERR_POSTPROCESSING_INTERNAL = "Internal error during postprocessing."

ERR_NOTIFYING_INTERNAL = "Internal error during relocation notification."

ERR_COMPLETED_INTERNAL = "Internal error during relocation wrap-up."


@instrumented_task(
    name="sentry.relocation.uploading_start",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
)
def uploading_start(uuid: UUID, replying_region_name: str | None, org_slug: str | None) -> None:
    """
    The very first action in the relocation pipeline. In the case of a `SAAS_TO_SAAS` relocation, it
    will trigger the export of the requested organization from the region it currently live in. If
    this is a `SELF_HOSTED` relocation, this task is a no-op that merely auto-triggers the next step
    in the chain, `upload_complete`.

    In the case of a `SAAS_TO_SAAS` relocation, we'll need to export an organization from the
    exporting region (ER) back to the requesting region (RR - where this method is running). Because
    region-to-region messaging is forbidden, all of this messaging will need to be proxied via the
    control silo (CS). Thus, to accomplish this export-and-copy operation, we'll need to use
    sequenced RPC calls to fault-tolerantly execute code in these three siloed locations.

    Due to of our system architecture, the sequence of remote functions executed can be a bit hard
    to follow, so it is diagrammed and listed below. Each function executed is given a sequential
    numerical identifier and is annotated with information about where to find the source and which
    silo it will be executed in:


        | Requesting |            |   Control  |            | Exporting  |
        |    (RR)    |            |    (CS)    |            |    (ER)    |
        |============|            |============|            |============|
        |            |            |            |            |            |
        |     01     |            |            |            |            |
        |            |-----02---->|            |            |            |
        |            |            |     03     |            |            |
        |            |            |     04     |            |            |
        |            |            |            |-----05---->|            |
        |            |            |            |            |     06     |
        |            |            |            |            |     07     |
        |            |            |            |            |     08     |
        |            |            |            |<----09-----|            |
        |            |            |     10     |            |            |
        |            |            |     11     |            |            |
        |            |<----12-----|            |            |            |
        |     13     |            |            |            |            |
        |            |            |            |            |            |


    01. (RR) .../tasks/relocation.py::uploading_start: This first function grabs this (aka the
        "requesting" region) region's public key, then sends an RPC call to the control silo,
        requesting an export of some `org_slug` from the `replying_region_name` in which is lives.
    02. The `ProxyingRelocationExportService::request_new_export` call is sent over the wire from
        the requesting region to the control silo.
    03. (CS) .../relocation_export/impl.py::ProxyingRelocationExportService::request_new_export: The
        request RPC call is received, and is immediately packaged into a `ControlOutbox`, so that we
        may robustly forward it to the exporting region. This task successfully completing causes
        the RPC to successfully return to the sender, allowing the calling `uploading_start` celery
        task to finish successfully as well.
    04. (CS) .../receiver/outbox/control.py::process_relocation_request_new_export: Whenever an
        outbox draining attempt occurs, this code will be called to forward the proxied call into
        the exporting region.
    05. The `DBBackedExportService::request_new_export` call is sent over the wire from the control
        silo to the exporting region.
    06. (ER) .../relocation_export/impl.py::DBBackedRelocationExportService::request_new_export: The
        request RPC call is received, and immediately schedules the
        `fulfill_cross_region_export_request` celery task, which uses an exponential backoff
        algorithm to try and create an encrypted tarball containing an export of the requested org
        slug.
    07. (ER) .../tasks/relocation.py::fulfill_cross_region_export_request: This celery task performs
        the actual export operation locally in the exporting region. This data is written as a file
        to this region's relocation-specific GCS bucket, and the response is immediately packaged
        into a `RegionOutbox`, so that we may robustly attempt to send it at drain-time.
    08. (ER) .../receiver/outbox/region.py::process_relocation_reply_with_export: Whenever an outbox
        draining attempt occurs, this code will be called to read the saved export data from the
        local GCS bucket, package it into an RPC call, and send it back to the proxy.
    09. The `ProxyingRelocationExportService::reply_with_export` call is sent over the wire from the
        exporting region back to the control silo.
    10. (CS) .../relocation_export/impl.py::ProxyingRelocationExportService::reply_with_export: The
        request RPC call is received, and is immediately packaged into a `ControlOutbox`, so that we
        may robustly forward it back to the requesting region. To ensure robustness, the export data
        is saved to a local file, so that outbox drain attempts can read it locally without needing
        to make their own nested RPB calls.
    11. (CS) .../receiver/outbox/control.py::process_relocation_reply_with_export: Whenever an
        outbox draining attempt occurs, this code will be called to read the export data from the
        local relocation-specific GCS bucket, then forward it into the requesting region.
    12. The `DBBackedExportService::reply_with_export` call is sent over the wire from the control
        silo back to the requesting region.
    13. (RR) .../relocation_export/impl.py::DBBackedRelocationExportService::reply_with_export:
        We've made it all the way back! The export data gets saved to a `RelocationFile` associated
        with the `Relocation` that originally triggered `uploading_start`, and the next task in the
        sequence (`uploading_complete`) is scheduled.
    """

    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.UPLOADING_START,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.UPLOADING_START,
        attempts_left,
        ERR_UPLOADING_FAILED,
    ):
        # If SAAS->SAAS, kick off an export on the source region. In this case, we will not schedule
        # an `uploading_complete` task - this region's `RelocationExportService.reply_with_export`
        # method will wait for a reply from the work we've scheduled here, which will be in charge
        # of writing the `RelocationFile` from the exported data and kicking off
        # `uploading_complete` with the export data from the source region.
        if relocation.provenance == Relocation.Provenance.SAAS_TO_SAAS:
            if not org_slug:
                return fail_relocation(
                    relocation,
                    OrderedTask.UPLOADING_START,
                    ERR_UPLOADING_NO_SAAS_TO_SAAS_ORG_SLUG,
                )

            # We want to encrypt this organization from the other region using this region's public
            # key.
            public_key_pem = GCPKMSEncryptor.from_crypto_key_version(
                get_default_crypto_key_version()
            ).get_public_key_pem()

            # Send out the cross-region request.
            control_relocation_export_service.request_new_export(
                relocation_uuid=str(uuid),
                requesting_region_name=get_local_region().name,
                replying_region_name=replying_region_name,
                org_slug=org_slug,
                encrypt_with_public_key=public_key_pem,
            )

            # Make sure we're not waiting forever for our cross-region check to come back. After a
            # reasonable amount of time, go ahead and fail the relocation.
            cross_region_export_timeout_check.apply_async(
                args=[uuid],
                countdown=int(CROSS_REGION_EXPORT_TIMEOUT.total_seconds()),
            )
            return

        # If this is a regular self-hosted relocation, we have nothing to do here, so just move on
        # to the next step.
        uploading_complete.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.fulfill_cross_region_export_request",
    queue="relocation",
    autoretry_for=(Exception,),
    # So the 1st retry is after ~0.5 min, 2nd after ~1 min, 3rd after ~2 min, 4th after ~4 min.
    max_retries=4,
    retry_backoff=30,
    retry_backoff_jitter=True,
    # Setting `acks_late` + `reject_on_worker_lost` here allows us to retry the potentially
    # long-lived task if the k8s pod of the worker received SIGKILL/TERM/QUIT (or we ran out of some
    # other resource, leading to the same outcome). We have a timeout check at the very start of the
    # task itself to make sure it does not loop indefinitely.
    acks_late=True,
    reject_on_worker_lost=True,
    # 10 minutes per try.
    soft_time_limit=60 * 10,
    silo_mode=SiloMode.REGION,
)
def fulfill_cross_region_export_request(
    uuid_str: str,
    requesting_region_name: str,
    replying_region_name: str,
    org_slug: str,
    encrypt_with_public_key: bytes,
    # Unix timestamp, in seconds.
    scheduled_at: int,
) -> None:
    """
    Unlike most other tasks in this file, this one is not an `OrderedTask` intended to be
    sequentially executed as part of the relocation pipeline. Instead, its job is to export an
    already existing organization from an adjacent region. That means it is triggered (via RPC - the
    `relocation_export` service for more) on that region from the `uploading_start` task, which then
    waits for the exporting region to issue an RPC call back with the data. Once that replying RPC
    call is received with the encrypted export in tow, it will trigger the next step in the
    `SAAS_TO_SAAS` relocation's pipeline, namely `uploading_complete`.
    """

    logger_data = {
        "uuid": uuid_str,
        "task": "fulfill_cross_region_export_request",
        "requesting_region_name": requesting_region_name,
        "replying_region_name": replying_region_name,
        "org_slug": org_slug,
        "encrypted_public_key_size": len(encrypt_with_public_key),
        "scheduled_at": scheduled_at,
    }
    logger.info(
        "fulfill_cross_region_export_request: started",
        extra=logger_data,
    )

    # Because we use `acks_late`, we need to be careful to prevent infinite scheduling due to some
    # persistent bug, like an error in the export logic. So, if `CROSS_REGION_EXPORT_TIMEOUT` time
    # has elapsed, always fail this task. Note that we don't report proactively back this failure,
    # and instead wait for the timeout check to pick it up on the other end.
    scheduled_at_dt = datetime.fromtimestamp(scheduled_at, tz=UTC)
    if scheduled_at_dt + CROSS_REGION_EXPORT_TIMEOUT < datetime.now(tz=UTC):
        logger.error(
            "fulfill_cross_region_export_request: timeout",
            extra=logger_data,
        )
        return

    log_gcp_credentials_details(logger)
    uuid = UUID(uuid_str)
    path = f"runs/{uuid}/saas_to_saas_export/{org_slug}.tar"
    relocation_storage = get_relocation_storage()
    fp = BytesIO()
    logger.info(
        "fulfill_cross_region_export_request: exporting",
        extra=logger_data,
    )

    export_in_organization_scope(
        fp,
        encryptor=LocalFileEncryptor(BytesIO(encrypt_with_public_key)),
        org_filter={org_slug},
        printer=LoggingPrinter(uuid),
        checkpointer=StorageBackedCheckpointExporter(
            crypto=EncryptorDecryptorPair(
                encryptor=GCPKMSEncryptor.from_crypto_key_version(get_default_crypto_key_version()),
                decryptor=GCPKMSDecryptor.from_bytes(
                    json.dumps(get_default_crypto_key_version()).encode("utf-8")
                ),
            ),
            uuid=uuid,
            storage=relocation_storage,
        ),
    )
    logger.info(
        "fulfill_cross_region_export_request: exported",
        extra=logger_data,
    )

    fp.seek(0)
    relocation_storage.save(path, fp)
    logger_data["encrypted_contents_size"] = fp.tell()
    logger.info(
        "fulfill_cross_region_export_request: saved",
        extra=logger_data,
    )

    identifier = uuid_to_identifier(uuid)
    RegionOutbox(
        shard_scope=OutboxScope.RELOCATION_SCOPE,
        category=OutboxCategory.RELOCATION_EXPORT_REPLY,
        shard_identifier=identifier,
        object_identifier=identifier,
        payload=RelocationExportReplyWithExportParameters(
            relocation_uuid=uuid_str,
            requesting_region_name=requesting_region_name,
            replying_region_name=replying_region_name,
            org_slug=org_slug,
        ).dict(),
    ).save()
    logger.info(
        "fulfill_cross_region_export_request: scheduled",
        extra=logger_data,
    )


@instrumented_task(
    name="sentry.relocation.cross_region_export_timeout_check",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def cross_region_export_timeout_check(
    uuid: UUID,
) -> None:
    """
    Not part of the primary `OrderedTask` queue. This task is only used to ensure that cross-region
    export requests don't hang indefinitely.
    """

    try:
        relocation = Relocation.objects.get(uuid=uuid)
    except Relocation.DoesNotExist:
        logger.exception("Could not locate Relocation model by UUID: %s", uuid)
        return

    logger_data = {"uuid": str(relocation.uuid), "task": "cross_region_export_timeout_check"}
    logger.info(
        "cross_region_export_timeout_check: started",
        extra=logger_data,
    )

    # We've moved past the `UPLOADING_START` step, so the cross-region response was received, one
    # way or another.
    if relocation.latest_task != OrderedTask.UPLOADING_START.name:
        logger.info(
            "cross_region_export_timeout_check: no timeout detected",
            extra=logger_data,
        )
        return

    # Another nested exception handler could have already failed this relocation - in this case, do
    # nothing.
    if relocation.status == Relocation.Status.FAILURE.value:
        logger.info(
            "cross_region_export_timeout_check: task already failed",
            extra=logger_data,
        )
        return

    reason = ERR_UPLOADING_CROSS_REGION_TIMEOUT.substitute(delta=CROSS_REGION_EXPORT_TIMEOUT)
    logger_data["reason"] = reason
    logger.error(
        "cross_region_export_timeout_check: timeout detected",
        extra=logger_data,
    )

    return fail_relocation(relocation, OrderedTask.UPLOADING_START, reason)


@instrumented_task(
    name="sentry.relocation.uploading_complete",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
)
def uploading_complete(uuid: UUID) -> None:
    """
    Just check to ensure that uploading the (potentially very large!) backup file has completed
    before we try to do all sorts of fun stuff with it.
    """

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
            .get()
        )
        fp = raw_relocation_file.file.getfile()
        with fp:
            preprocessing_scan.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.preprocessing_scan",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_scan(uuid: UUID) -> None:
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
            .get()
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

            # Grab usernames and org slugs from the JSON data, and record which users are members of
            # which orgs.
            found_user_org_memberships: dict[int, list[int]] = defaultdict(list)
            found_org_slugs: dict[int, str] = dict()
            found_usernames: dict[int, str] = dict()
            try:
                for json_model in json.loads(json_data):
                    model_name = NormalizedModelName(json_model["model"])
                    if get_model(model_name) == Organization:
                        found_org_slugs[json_model["pk"]] = json_model["fields"]["slug"]
                    if get_model(model_name) == OrganizationMember:
                        if json_model["fields"]["user_id"] is not None:
                            found_user_org_memberships[json_model["fields"]["user_id"]].append(
                                json_model["fields"]["organization"]
                            )
                    if get_model(model_name) == User:
                        found_usernames[json_model["pk"]] = json_model["fields"]["username"]
                        # TODO(getsentry/team-ospo#190): Validate username using regex, so that we
                        # can fail early on obviously invalid usernames. Also keeps the database
                        # `JSONField` from ballooning on bad input.
            except KeyError:
                return fail_relocation(
                    relocation, OrderedTask.PREPROCESSING_SCAN, ERR_PREPROCESSING_INVALID_JSON
                )

            # Discard `found_org_slugs` that were not explicitly requested by the user.
            want_org_slugs = set(relocation.want_org_slugs)
            found_org_slugs = {k: v for k, v in found_org_slugs.items() if v in want_org_slugs}
            found_org_ids = set(found_org_slugs.keys())
            for slug in want_org_slugs:
                try:
                    validate_sentry_slug(slug)
                except ValidationError:
                    return fail_relocation(
                        relocation,
                        OrderedTask.PREPROCESSING_SCAN,
                        ERR_PREPROCESSING_INVALID_ORG_SLUG.substitute(slug=slug),
                    )

            # Discard users that are not members of at least one of the `found_org_slugs`.
            want_usernames = {
                v
                for k, v in found_usernames.items()
                if found_org_ids & set(found_user_org_memberships[k])
            }

            # Ensure that the data is reasonable and within our set bounds before we start on the
            # next task.
            missing_org_slugs = want_org_slugs - set(found_org_slugs.values())
            if len(found_usernames) == 0:
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_NO_USERS,
                )
            if len(missing_org_slugs):
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_MISSING_ORGS.substitute(
                        orgs=",".join(sorted(missing_org_slugs))
                    ),
                )
            if len(found_org_slugs) > MAX_ORGS_PER_RELOCATION:
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_TOO_MANY_ORGS.substitute(count=len(found_org_slugs)),
                )
            if len(want_usernames) > MAX_USERS_PER_RELOCATION:
                return fail_relocation(
                    relocation,
                    OrderedTask.PREPROCESSING_SCAN,
                    ERR_PREPROCESSING_TOO_MANY_USERS.substitute(count=len(want_usernames)),
                )

            relocation.want_usernames = sorted(want_usernames)
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
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_transfer(uuid: UUID) -> None:
    """
    We currently have the user's relocation data stored in the main filestore bucket, but we need to
    move it to the relocation bucket. This task handles that transfer.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

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

        # Only test existing users for collision and mutation.
        existing_usernames = user_service.get_existing_usernames(
            usernames=relocation.want_usernames
        )
        relocation_storage.save(
            f"runs/{uuid}/in/filter-usernames.txt",
            BytesIO(",".join(existing_usernames or []).encode("utf-8")),
        )

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
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_baseline_config(uuid: UUID) -> None:
    """
    Pulls down the global config data we'll need to check for collisions and global data integrity.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

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
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_colliding_users(uuid: UUID) -> None:
    """
    Pulls down any already existing users whose usernames match those found in the import - we'll
    need to validate that none of these are mutated during import.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

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
            user_filter=set(relocation.want_usernames or ()),
            printer=LoggingPrinter(uuid),
        )
        fp.seek(0)
        relocation_storage.save(path, fp)

    preprocessing_complete.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.preprocessing_complete",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=MEDIUM_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def preprocessing_complete(uuid: UUID) -> None:
    """
    This task ensures that every file CloudBuild will need to do its work is actually present and
    available. Even if we've "finished" our uploads from the previous step, they may still not (yet)
    be available on the read side, so this final step just gives us a bit of buffer to ensure that
    this is the case.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

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
        if not relocation_storage.exists(f"runs/{uuid}/in/filter-usernames.txt"):
            raise FileNotFoundError("Could not locate `filter-usernames.txt` in relocation bucket.")
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
        uuid_str = str(relocation.uuid)
        uuid = UUID(uuid_str)

        # If no interesting status updates occurred, check again in a minute.
        if status == ValidationStatus.IN_PROGRESS:
            logger.info(
                "Validation polling: scheduled",
                extra={"uuid": uuid_str, "task": task.name},
            )
            return NextTask(
                task=validating_poll,
                args=[uuid, str(relocation_validation_attempt.build_id)],
                countdown=60,
            )

        relocation_validation_attempt.status = status.value

        # These statuses merit failing this attempt and kicking off a new
        # `RelocationValidationAttempt`, if possible.
        if status in {ValidationStatus.TIMEOUT, ValidationStatus.FAILURE}:
            if relocation_validation.attempts < MAX_VALIDATION_POLL_ATTEMPTS:
                relocation_validation_attempt.status = status.value
                relocation_validation_attempt.save()

                # Go back to `validating_start`; since this is a new attempt at that task, we reset
                # the `latest_task_attempts` counter to 0.
                relocation.latest_task = OrderedTask.VALIDATING_START.name
                relocation.latest_task_attempts = 0
                relocation.save()

                logger.info(
                    "Validation timed out",
                    extra={"uuid": uuid_str, "task": task.name},
                )

                return NextTask(task=validating_start, args=[uuid])

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
                extra={"uuid": uuid_str, "task": task.name},
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
            extra={"uuid": uuid_str, "task": task.name},
        )

        return NextTask(task=importing, args=[uuid])


@instrumented_task(
    name="sentry.relocation.validating_start",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def validating_start(uuid: UUID) -> None:
    """
    Calls into Google CloudBuild and kicks off a validation run.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

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
            tags=[
                f"relocation-into-{get_local_region().name}",
                f"relocation-id-{uuid}",
            ],
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
    autoretry_for=(Exception,),
    max_retries=MAX_VALIDATION_POLLS,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def validating_poll(uuid: UUID, build_id: str) -> None:
    """
    Checks the progress of a Google CloudBuild validation run.

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

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
            "uuid": str(relocation.uuid),
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
        timeout_limit = datetime.now(UTC) - DEFAULT_VALIDATION_TIMEOUT

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
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def validating_complete(uuid: UUID, build_id: str) -> None:
    """
    Wraps up a validation run, and reports on what we found. If this task is being called, the
    CloudBuild run as completed successfully, so we just need to figure out if there were any
    findings (failure) or not (success).

    This function is meant to be idempotent, and should be retried with an exponential backoff.
    """

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
        storage = get_relocation_storage()
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
    autoretry_for=(Exception,),
    # At first blush, it would seem that retrying a failed import will leave a bunch of "abandoned"
    # data from the previous one, but that is not actually the case: because we use this relocation
    # UUID as the `import_uuid` for the `import_in...` call, we'll be able to re-use all of the
    # already-written import chunks (and, by extension, their models). This is due to each import
    # write operation atomically checking the relevant `ImportChunk` table for collisions at
    # database write time. So it will attempt to write a new copy, realize that this `(import_uuid,
    # model, ordinal)` three-tuple has already been written, and return that information instead.
    # Basically, all of the already completed write operations will be no-ops that return the
    # already-written models and pk maps, and we'll pick up right where we left off.
    #
    # The main reason to have this at all is to guard against transient errors, especially with RPC
    # or task timeouts.
    max_retries=MAX_SLOW_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    # Setting `acks_late` here allows us to retry the potentially long-lived task if the k8s pod if
    # the worker received SIGKILL/TERM/QUIT. Since the `Relocation` model itself is counting the
    # number of attempts using `latest_task_attempts` anyway, we ensure that this won't result in an
    # infinite loop of very long-lived tasks being continually retried.
    acks_late=True,
    soft_time_limit=SLOW_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def importing(uuid: UUID) -> None:
    """
    Perform the import on the actual live instance we are targeting.

    This function is NOT idempotent - if an import breaks, we should just abandon it rather than
    trying it again!
    """

    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.IMPORTING,
        allowed_task_attempts=MAX_SLOW_TASK_ATTEMPTS,
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
            .get()
        )
        relocation_data_fp = raw_relocation_file.file.getfile()
        log_gcp_credentials_details(logger)
        kms_config_fp = BytesIO(json.dumps(get_default_crypto_key_version()).encode("utf-8"))

        with relocation_data_fp, kms_config_fp:
            import_in_organization_scope(
                relocation_data_fp,
                decryptor=GCPKMSDecryptor(kms_config_fp),
                flags=ImportFlags(
                    import_uuid=str(uuid),
                    hide_organizations=True,
                    merge_users=relocation.provenance == Relocation.Provenance.SAAS_TO_SAAS,
                    overwrite_configs=False,
                ),
                org_filter=set(relocation.want_org_slugs),
                printer=LoggingPrinter(uuid),
            )

    postprocessing.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.postprocessing",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def postprocessing(uuid: UUID) -> None:
    """
    Make the owner of this relocation an owner of all of the organizations we just imported.
    """

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
        uuid_str = str(uuid)
        imported_org_ids: set[int] = set()
        for chunk in RegionImportChunk.objects.filter(
            import_uuid=uuid_str, model="sentry.organization"
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
        for _, result in relocated.send_robust(sender=postprocessing, relocation_uuid=uuid_str):
            if isinstance(result, Exception):
                raise result

        # This signal must come after the relocated signal, to ensure that the subscription and
        # customer models have been appropriately set up before attempting to redeem a promo code.
        relocation_redeem_promo_code.send_robust(
            sender=postprocessing,
            user_id=relocation.owner_id,
            relocation_uuid=uuid_str,
            orgs=list(imported_orgs),
        )

        for org in imported_orgs:
            try:
                analytics.record(
                    "relocation.organization_imported",
                    organization_id=org.id,
                    relocation_uuid=uuid_str,
                    slug=org.slug,
                    owner_id=relocation.owner_id,
                )
            except Exception as e:
                capture_exception(e)

        notifying_unhide.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.notifying_unhide",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def notifying_unhide(uuid: UUID) -> None:
    """
    Un-hide the just-imported organizations, making them visible to users in the UI.
    """

    (relocation, attempts_left) = start_relocation_task(
        uuid=uuid,
        task=OrderedTask.NOTIFYING_UNHIDE,
        allowed_task_attempts=MAX_FAST_TASK_ATTEMPTS,
    )
    if relocation is None:
        return

    with retry_task_or_fail_relocation(
        relocation,
        OrderedTask.NOTIFYING_UNHIDE,
        attempts_left,
        ERR_NOTIFYING_INTERNAL,
    ):
        imported_org_ids: set[int] = set()
        for chunk in RegionImportChunk.objects.filter(
            import_uuid=str(uuid), model="sentry.organization"
        ):
            imported_org_ids = imported_org_ids.union(set(chunk.inserted_map.values()))

        # Reveal all imported organizations to their users.
        with transaction.atomic(router.db_for_write(Organization)):
            imported_orgs = Organization.objects.filter(id__in=imported_org_ids)
            for org in imported_orgs:
                if org.status == OrganizationStatus.RELOCATION_PENDING_APPROVAL:
                    org.status = OrganizationStatus.ACTIVE
                org.save()

    notifying_users.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.notifying_users",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def notifying_users(uuid: UUID) -> None:
    """
    Send an email to all users that have been imported, telling them to claim their accounts.
    """

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
        uuid_str = str(uuid)
        imported_user_ids: set[int] = set()
        chunks = ControlImportChunkReplica.objects.filter(import_uuid=uuid_str, model="sentry.user")
        for control_chunk in chunks:
            imported_user_ids = imported_user_ids.union(set(control_chunk.inserted_map.values()))

        imported_org_slugs: set[str] = set()
        for region_chunk in RegionImportChunk.objects.filter(
            import_uuid=uuid_str, model="sentry.organization"
        ):
            imported_org_slugs = imported_org_slugs.union(
                set(region_chunk.inserted_identifiers.values())
            )

        # Do a sanity check on pk-mapping before we go and reset the passwords of random users - are
        # all of these usernames plausibly ones that were included in the import, based on username
        # prefix matching?
        imported_users = user_service.get_many(filter={"user_ids": list(imported_user_ids)})
        for user in imported_users:
            matched_prefix = False
            for username_prefix in relocation.want_usernames or ():
                if user.username.startswith(username_prefix):
                    matched_prefix = True
                    break

            # This should always be treated as an internal logic error, since we just wrote these
            # orgs, so probably there is a serious bug with pk mapping.
            assert matched_prefix is True

        # Okay, everything seems fine - go ahead and send those emails.
        for user in imported_users:
            # Sometimes, we merge users together before unpausing a relocation. No need to send an
            # email to these users!
            if not user.is_unclaimed:
                continue

            hash = lost_password_hash_service.get_or_create(user_id=user.id).hash
            LostPasswordHash.send_relocate_account_email(user, hash, list(imported_org_slugs))

        relocation.latest_unclaimed_emails_sent_at = datetime.now(UTC)
        relocation.save()

    notifying_owner.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.notifying_owner",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def notifying_owner(uuid: UUID) -> None:
    """
    Send an email to the creator and owner, telling them that their relocation was successful.
    """

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
        uuid_str = str(uuid)
        imported_org_slugs: set[int] = set()
        for chunk in RegionImportChunk.objects.filter(
            import_uuid=uuid_str, model="sentry.organization"
        ):
            imported_org_slugs = imported_org_slugs.union(set(chunk.inserted_identifiers.values()))

        send_relocation_update_email(
            relocation,
            Relocation.EmailKind.SUCCEEDED,
            {
                "uuid": uuid_str,
                "orgs": list(imported_org_slugs),
            },
        )

    completed.apply_async(args=[uuid])


@instrumented_task(
    name="sentry.relocation.completed",
    queue="relocation",
    autoretry_for=(Exception,),
    max_retries=MAX_FAST_TASK_RETRIES,
    retry_backoff=RETRY_BACKOFF,
    retry_backoff_jitter=True,
    soft_time_limit=FAST_TIME_LIMIT,
    silo_mode=SiloMode.REGION,
)
def completed(uuid: UUID) -> None:
    """
    Finish up a relocation by marking it a success.
    """

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
    OrderedTask.UPLOADING_START: uploading_start,
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
    OrderedTask.NOTIFYING_UNHIDE: notifying_unhide,
    OrderedTask.NOTIFYING_USERS: notifying_users,
    OrderedTask.NOTIFYING_OWNER: notifying_owner,
    OrderedTask.COMPLETED: completed,
}

assert set(OrderedTask._member_map_.keys()) == {k.name for k in TASK_MAP.keys()}


def get_first_task_for_step(target_step: Relocation.Step) -> Task | None:
    min_task: OrderedTask | None = None
    for ordered_task, step in TASK_TO_STEP.items():
        if step == target_step:
            if min_task is None or ordered_task.value < min_task.value:
                min_task = ordered_task

    if min_task is None or min_task == OrderedTask.NONE:
        return None

    return TASK_MAP.get(min_task, None)
