from __future__ import annotations

import logging
from contextlib import contextmanager
from enum import Enum, unique
from functools import lru_cache
from string import Template
from typing import Any, Generator, Optional, Tuple

from django.utils import timezone

from sentry import options
from sentry.backup.dependencies import dependencies, get_model_name, sorted_dependencies
from sentry.backup.helpers import Printer
from sentry.backup.scopes import RelocationScope
from sentry.http import get_server_hostname
from sentry.models.files.utils import get_relocation_storage
from sentry.models.relocation import Relocation, RelocationFile
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.utils.email.message_builder import MessageBuilder as MessageBuilder

logger = logging.getLogger("sentry.relocation.tasks")


# Relocation tasks are always performed in sequential order. We can leverage this to check for any
# weird out-of-order executions.
@unique
class OrderedTask(Enum):
    NONE = 0
    UPLOADING_COMPLETE = 1
    PREPROCESSING_SCAN = 2
    PREPROCESSING_TRANSFER = 3
    PREPROCESSING_BASELINE_CONFIG = 4
    PREPROCESSING_COLLIDING_USERS = 5
    PREPROCESSING_COMPLETE = 6
    VALIDATING_START = 7
    VALIDATING_POLL = 8
    VALIDATING_COMPLETE = 9
    IMPORTING = 10
    POSTPROCESSING = 11
    NOTIFYING_USERS = 12
    NOTIFYING_OWNER = 13
    COMPLETED = 14


# Match each `OrderedTask` to the `Relocation.Step` it is part of.
TASK_TO_STEP: dict[OrderedTask, Relocation.Step] = {
    OrderedTask.NONE: Relocation.Step.UNKNOWN,
    OrderedTask.UPLOADING_COMPLETE: Relocation.Step.UPLOADING,
    OrderedTask.PREPROCESSING_SCAN: Relocation.Step.PREPROCESSING,
    OrderedTask.PREPROCESSING_TRANSFER: Relocation.Step.PREPROCESSING,
    OrderedTask.PREPROCESSING_BASELINE_CONFIG: Relocation.Step.PREPROCESSING,
    OrderedTask.PREPROCESSING_COLLIDING_USERS: Relocation.Step.PREPROCESSING,
    OrderedTask.PREPROCESSING_COMPLETE: Relocation.Step.PREPROCESSING,
    OrderedTask.VALIDATING_START: Relocation.Step.VALIDATING,
    OrderedTask.VALIDATING_POLL: Relocation.Step.VALIDATING,
    OrderedTask.VALIDATING_COMPLETE: Relocation.Step.VALIDATING,
    OrderedTask.IMPORTING: Relocation.Step.IMPORTING,
    OrderedTask.POSTPROCESSING: Relocation.Step.POSTPROCESSING,
    OrderedTask.NOTIFYING_USERS: Relocation.Step.NOTIFYING,
    OrderedTask.NOTIFYING_OWNER: Relocation.Step.NOTIFYING,
    OrderedTask.COMPLETED: Relocation.Step.COMPLETED,
}


assert list(OrderedTask._member_map_.keys()) == [k.name for k in TASK_TO_STEP.keys()]


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
# ~200MB, so we should never see more than ~4 blobs in practice.
RELOCATION_BLOB_SIZE = int((2**31) / 32)


# Create the relevant directories: a `/workspace/in` directory containing the inputs that will
# be imported, a `/workspace/out` directory for exports that will be generated, and
# `/workspace/findings` for findings.
#
# TODO(getsentry/team-ospo#190): Make `get-self-hosted-repo` pull a pinned version, not
# mainline.
#
# TODO(getsentry/team-ospo#216): Use script in self-hosted to completely flush db instead of
# using truncation tables.
CLOUDBUILD_YAML_TEMPLATE = Template(
    """
steps:

  ##############################
  ### Setup steps
  ##############################

  - name: "gcr.io/cloud-builders/gsutil"
    id: copy-inputs-being-validated
    waitFor: ["-"]
    args: ["cp", "-r", "$bucket_root/runs/$uuid/in", "."]
    timeout: 600s


  - name: "gcr.io/cloud-builders/docker"
    id: create-working-dirs
    waitFor: ["-"]
    entrypoint: "bash"
    args:
      - "-e"
      - "-c"
      - |
        mkdir /workspace/out && chmod 777 /workspace/out
        mkdir /workspace/findings && chmod 777 /workspace/findings
        echo '[]' > /workspace/findings/null.json
    timeout: 15s


  - name: "gcr.io/cloud-builders/docker"
    id: get-self-hosted-repo
    waitFor: ["-"]
    entrypoint: "bash"
    args:
      - "-e"
      - "-c"
      - |
        mkdir self-hosted && cd self-hosted
        curl -L "https://github.com/getsentry/self-hosted/archive/$self_hosted_version.tar.gz" | tar xzf - --strip-components=1
        echo '{"version": "3.4", "networks":{"default":{"external":{"name":"cloudbuild"}}}}' > docker-compose.override.yml
    timeout: 120s


  - name: "gcr.io/cloud-builders/docker"
    id: run-install-script
    waitFor:
      - get-self-hosted-repo
    entrypoint: "bash"
    dir_: self-hosted
    args:
      - "-e"
      - "-c"
      - |
        ./install.sh --skip-commit-check --skip-user-creation
    timeout: 600s


  - name: "gcr.io/cloud-builders/docker"
    id: instance-ready
    waitFor:
      - run-install-script
    args:
      $docker_compose_cmd
      - "up"
      - "-d"
    timeout: 900s


  - name: "gcr.io/cloud-builders/docker"
    id: clear-database
    waitFor:
      - instance-ready
    args:
      $docker_compose_cmd
      - "exec"
      - "-T"
      - "postgres"
      - "psql"
      - "-U"
      - "postgres"
      - "-c"
      - "TRUNCATE $truncate_tables RESTART IDENTITY CASCADE;"
    timeout: 30s

  ##############################
  ### Validation steps
  ##############################
  $validation_steps

artifacts:
  objects:
    location: "$bucket_root/runs/$uuid/findings/"
    paths: ["/workspace/findings/**"]
timeout: 3600s
options:
  machineType: "N1_HIGHCPU_32"
  env:
    - "REPORT_SELF_HOSTED_ISSUES=0"
tags: ["cloud-builders-community"]
"""
)

IMPORT_VALIDATION_STEP_TEMPLATE = Template(
    """
  - name: "gcr.io/cloud-builders/docker"
    id: import-$kind
    waitFor:
      - copy-inputs-being-validated
      - create-working-dirs
      - clear-database
      $wait_for
    args:
      $docker_compose_cmd
      $docker_compose_run
      - "-v"
      - "/workspace/in:/in"
      - "-v"
      - "/workspace/findings:/findings"
      - "web"
      - "import"
      - "$scope"
      - "/in/$tarfile"
      - "--decrypt-with-gcp-kms"
      - "/in/kms-config.json"
      - "--findings-file"
      - "/findings/import-$jsonfile"
      $args
    timeout: 300s
    """
)

EXPORT_VALIDATION_STEP_TEMPLATE = Template(
    """
  - name: "gcr.io/cloud-builders/docker"
    id: export-$kind
    waitFor:
      - import-$kind
      $wait_for
    args:
      $docker_compose_cmd
      $docker_compose_run
      - "-v"
      - "/workspace/in:/in"
      - "-v"
      - "/workspace/out:/out"
      - "-v"
      - "/workspace/findings:/findings"
      - "-e"
      - "SENTRY_LOG_LEVEL=CRITICAL"
      - "web"
      - "export"
      - "$scope"
      - "/out/$tarfile"
      - "--encrypt-with-gcp-kms"
      - "/in/kms-config.json"
      - "--findings-file"
      - "/findings/export-$jsonfile"
      $args
    timeout: 300s
    """
)

COPY_OUT_DIR_TEMPLATE = Template(
    """
  - name: 'gcr.io/cloud-builders/gsutil'
    id: copy-out-dir
    waitFor:
      $wait_for
    args:
      - 'cp'
      - '-r'
      - '/workspace/out'
      - '$bucket_root/runs/$uuid/out'
    timeout: 30s
    """
)

COMPARE_VALIDATION_STEP_TEMPLATE = Template(
    """
  - name: "gcr.io/cloud-builders/docker"
    id: compare-$kind
    waitFor:
      - export-$kind
      $wait_for
    args:
      $docker_compose_cmd
      $docker_compose_run
      - "-v"
      - "/workspace/in:/in"
      - "-v"
      - "/workspace/out:/out"
      - "-v"
      - "/workspace/findings:/findings"
      - "web"
      - "backup"
      - "compare"
      - "/in/$tarfile"
      - "/out/$tarfile"
      - "--decrypt-left-with-gcp-kms"
      - "/in/kms-config.json"
      - "--decrypt-right-with-gcp-kms"
      - "/in/kms-config.json"
      - "--findings-file"
      - "/findings/compare-$jsonfile"
      $args
    timeout: 300s
    """
)


# A custom logger that roughly matches the parts of the `click.echo` interface that the
# `import_*` methods rely on.
class LoggingPrinter(Printer):
    def __init__(self, uuid: str):
        self.uuid = uuid
        super().__init__()

    def echo(
        self,
        text: str,
        *,
        err: bool = False,
        color: bool | None = None,
    ) -> None:
        if err:
            logger.error(
                "Import failed: %s",
                text,
                extra={"uuid": self.uuid, "task": OrderedTask.IMPORTING.name},
            )
        else:
            logger.info(
                "Import info: %s",
                text,
                extra={"uuid": self.uuid, "task": OrderedTask.IMPORTING.name},
            )


def send_relocation_update_email(
    relocation: Relocation, email_kind: Relocation.EmailKind, args: dict[str, Any]
) -> None:
    name = str(email_kind.name)
    name_lower = name.lower()
    msg = MessageBuilder(
        subject=f"{options.get('mail.subject-prefix')} Your Relocation has {name.capitalize()}",
        template=f"sentry/emails/relocation_{name_lower}.txt",
        html_template=f"sentry/emails/relocation_{name_lower}.html",
        type=f"relocation.{name_lower}",
        context={"domain": get_server_hostname(), "datetime": timezone.now(), **args},
    )
    email_to = []
    owner = user_service.get_user(user_id=relocation.owner_id)
    if owner is not None:
        email_to.append(owner.email)

    if relocation.owner_id != relocation.creator_id:
        creator = user_service.get_user(user_id=relocation.creator_id)
        if creator is not None:
            email_to.append(creator.email)

    msg.send_async(to=email_to)

    relocation.latest_notified = email_kind.value
    relocation.save()


def start_relocation_task(
    uuid: str, task: OrderedTask, allowed_task_attempts: int
) -> Tuple[Optional[Relocation], int]:
    """
    All tasks for relocation are done sequentially, and take the UUID of the `Relocation` model as
    the input. We can leverage this information to do some common pre-task setup.

    Returns a tuple of relocation model and the number of attempts remaining for this task.
    """

    logger_data = {"uuid": uuid}
    try:
        relocation: Relocation = Relocation.objects.get(uuid=uuid)
    except Relocation.DoesNotExist:
        logger.exception("Could not locate Relocation model by UUID: %s", uuid)
        return (None, 0)

    if relocation.status not in {
        Relocation.Status.IN_PROGRESS.value,
        Relocation.Status.PAUSE.value,
    }:
        logger.warning(
            "Relocation has already completed as `%s`",
            Relocation.Status(relocation.status),
            extra=logger_data,
        )
        return (None, 0)

    try:
        prev_task_name = "" if task.value == 1 else OrderedTask(task.value - 1).name
    except Exception:
        logger.exception("Attempted to execute unknown relocation task", extra=logger_data)
        fail_relocation(relocation, OrderedTask.NONE)
        return (None, 0)

    logger_data["task"] = task.name
    if relocation.latest_task == task.name:
        relocation.latest_task_attempts += 1
    elif relocation.latest_task not in {prev_task_name, task.name}:
        logger.error(
            "Task %s tried to follow %s which is the wrong order",
            task.name,
            relocation.latest_task,
            extra=logger_data,
        )
        fail_relocation(relocation, task)
        return (None, 0)
    else:
        relocation.latest_task = task.name
        relocation.latest_task_attempts = 1

    step = TASK_TO_STEP[task]
    is_new_step = relocation.step + 1 == step.value
    at_scheduled_cancel = is_new_step and relocation.scheduled_cancel_at_step == step.value
    if at_scheduled_cancel:
        logger.info("Task aborted due to relocation cancellation request", extra=logger_data)
        relocation.step = step.value
        relocation.status = Relocation.Status.FAILURE.value
        relocation.scheduled_pause_at_step = None
        relocation.scheduled_cancel_at_step = None
        relocation.failure_reason = "This relocation was cancelled by an administrator."
        relocation.save()
        return (None, 0)

    # TODO(getsentry/team-ospo#216): Add an option like 'relocation:autopause-at-steps', which will
    # be an array of steps that we want relocations to automatically pause at. Will be useful once
    # we have self-serve relocations, and want a means by which to check their validity (bugfixes,
    # etc).
    at_scheduled_pause = is_new_step and relocation.scheduled_pause_at_step == step.value
    if relocation.status == Relocation.Status.PAUSE.value or at_scheduled_pause:
        logger.info("Task aborted due to relocation pause", extra=logger_data)

        # Pause the relocation. We will not be able to pause at this step again once we restart.
        relocation.step = step.value
        relocation.status = Relocation.Status.PAUSE.value
        relocation.scheduled_pause_at_step = None
        relocation.save()
        return (None, 0)

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

    # Another nested exception handler could have already failed this relocation - in this case, do
    # nothing.
    if relocation.status == Relocation.Status.FAILURE.value:
        return

    if reason:
        relocation.failure_reason = reason

    relocation.status = Relocation.Status.FAILURE.value
    relocation.save()

    logger.info("Task failed", extra={"uuid": relocation.uuid, "task": task.name, "reason": reason})
    send_relocation_update_email(
        relocation,
        Relocation.EmailKind.FAILED,
        {
            "uuid": str(relocation.uuid),
            "reason": reason,
        },
    )


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
        else:
            logger_data["reason"] = reason
            logger.info("Task retried", extra=logger_data)

        raise e
    else:
        logger.info("Task finished", extra=logger_data)


def make_cloudbuild_step_args(indent: int, args: list[str]) -> str:
    return f"\n{'  ' * indent}".join([f'- "{arg}"' for arg in args])


# The set of arguments to invoke a "docker compose" in a cloudbuild step is tedious and repetitive -
# better to just handle it here.
@lru_cache(maxsize=1)
def get_docker_compose_cmd():
    return make_cloudbuild_step_args(
        3,
        [
            "compose",
            "-f",
            "/workspace/self-hosted/docker-compose.yml",
            "-f",
            "/workspace/self-hosted/docker-compose.override.yml",
        ],
    )


# The set of arguments to invoke a "docker compose run" in a cloudbuild step is tedious and
# repetitive - better to just handle it here.
@lru_cache(maxsize=1)
def get_docker_compose_run():
    return make_cloudbuild_step_args(
        3,
        [
            "run",
            "--rm",
            "-T",
        ],
    )


@lru_cache(maxsize=1)
def get_relocations_bucket_name():
    """
    When using the local FileSystemStorage (ie, in tests), we use a contrived bucket name, since
    this is really just an alias for a bespoke local directory in that case.
    """

    storage = get_relocation_storage()
    return "default" if getattr(storage, "bucket_name", None) is None else f"{storage.bucket_name}"


def create_cloudbuild_yaml(relocation: Relocation) -> bytes:
    # Only test existing users for collision and mutation.
    existing_usernames = user_service.get_existing_usernames(usernames=relocation.want_usernames)
    filter_usernames_args = [
        "--filter-usernames",
        ",".join(existing_usernames) if existing_usernames else ",",
    ]
    filter_org_slugs_args = ["--filter-org-slugs", ",".join(relocation.want_org_slugs)]
    bucket_root = f"gs://{get_relocations_bucket_name()}"

    validation_steps = [
        create_cloudbuild_validation_step(
            id="import-baseline-config",
            step=IMPORT_VALIDATION_STEP_TEMPLATE,
            scope="config",
            wait_for=[],
            kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA,
            args=["--overwrite-configs"],
        ),
        create_cloudbuild_validation_step(
            id="import-colliding-users",
            step=IMPORT_VALIDATION_STEP_TEMPLATE,
            scope="users",
            wait_for=["import-baseline-config"],
            kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA,
            args=filter_usernames_args,
        ),
        create_cloudbuild_validation_step(
            id="import-raw-relocation-data",
            step=IMPORT_VALIDATION_STEP_TEMPLATE,
            scope="organizations",
            wait_for=["import-colliding-users"],
            kind=RelocationFile.Kind.RAW_USER_DATA,
            args=filter_org_slugs_args,
        ),
        create_cloudbuild_validation_step(
            id="export-baseline-config",
            step=EXPORT_VALIDATION_STEP_TEMPLATE,
            scope="config",
            wait_for=["import-raw-relocation-data"],
            kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA,
            args=[],
        ),
        create_cloudbuild_validation_step(
            id="export-colliding-users",
            step=EXPORT_VALIDATION_STEP_TEMPLATE,
            scope="users",
            wait_for=["export-baseline-config"],
            kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA,
            args=filter_usernames_args,
        ),
        create_cloudbuild_validation_step(
            id="export-raw-relocation-data",
            step=EXPORT_VALIDATION_STEP_TEMPLATE,
            scope="organizations",
            wait_for=["export-colliding-users"],
            kind=RelocationFile.Kind.RAW_USER_DATA,
            args=filter_org_slugs_args,
        ),
        COPY_OUT_DIR_TEMPLATE.substitute(
            bucket_root=bucket_root,
            uuid=relocation.uuid,
            wait_for=["export-raw-relocation-data"],
        ),
        create_cloudbuild_validation_step(
            id="compare-baseline-config",
            step=COMPARE_VALIDATION_STEP_TEMPLATE,
            scope="config",
            wait_for=["export-raw-relocation-data"],
            kind=RelocationFile.Kind.BASELINE_CONFIG_VALIDATION_DATA,
            args=[],
        ),
        create_cloudbuild_validation_step(
            id="compare-colliding-users",
            step=COMPARE_VALIDATION_STEP_TEMPLATE,
            scope="users",
            wait_for=["compare-baseline-config"],
            kind=RelocationFile.Kind.COLLIDING_USERS_VALIDATION_DATA,
            args=[],
        ),
        # TODO(getsentry/team-ospo#216): Add compare-raw-relocation-data as well.
    ]

    deps = dependencies()
    truncate_tables = [
        deps[get_model_name(m)].table_name
        for m in sorted_dependencies()
        if deps[get_model_name(m)].relocation_scope != RelocationScope.Excluded
    ]
    return CLOUDBUILD_YAML_TEMPLATE.substitute(
        docker_compose_cmd=get_docker_compose_cmd(),
        bucket_root=bucket_root,
        self_hosted_version="master",
        truncate_tables=",".join(truncate_tables),
        uuid=relocation.uuid,
        validation_steps="".join(validation_steps),
    ).encode("utf-8")


def create_cloudbuild_validation_step(
    id: str,
    step: Template,
    scope: str,
    wait_for: list[str],
    kind: RelocationFile.Kind,
    args: list[str],
) -> str:
    return step.substitute(
        args=make_cloudbuild_step_args(3, args),
        docker_compose_cmd=get_docker_compose_cmd(),
        docker_compose_run=get_docker_compose_run(),
        jsonfile=kind.to_filename("json"),
        kind=str(kind),
        scope=scope,
        tarfile=kind.to_filename("tar"),
        wait_for=make_cloudbuild_step_args(3, wait_for),
    )
