from __future__ import annotations

import logging
from contextlib import contextmanager
from enum import Enum, unique
from functools import lru_cache
from string import Template
from typing import Generator, Optional, Tuple

from sentry.backup.dependencies import dependencies, get_model_name, sorted_dependencies
from sentry.backup.scopes import RelocationScope
from sentry.models.files.utils import get_storage
from sentry.models.relocation import Relocation, RelocationFile
from sentry.models.user import User

logger = logging.getLogger("sentry.relocation.tasks")


# Relocation tasks are always performed in sequential order. We can leverage this to check for any
# weird out-of-order executions.
@unique
class OrderedTask(Enum):
    NONE = 0
    UPLOADING_COMPLETE = 1
    PREPROCESSING_SCAN = 2
    PREPROCESSING_BASELINE_CONFIG = 3
    PREPROCESSING_COLLIDING_USERS = 4
    PREPROCESSING_COMPLETE = 5
    VALIDATING_START = 6
    VALIDATING_POLL = 7
    VALIDATING_COMPLETE = 8
    IMPORTING = 9
    COMPLETED = 10


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


# Create the relevant directories: a `/workspace/in` directory containing the inputs that will
# be imported, a `/workspace/out` directory for exports that will be generated, and
# `/workspace/findings` for findings.
#
# TODO(getsentry/team-ospo#203): Make `get-self-hosted-repo` pull a pinned version, not
# mainline.
#
# TODO(getsentry/team-ospo#203): Use script in self-hosted to completely flush db instead of
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
    args: ["cp", "-r", "$bucket_root/relocations/runs/$uuid/in", "."]
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
    location: "$bucket_root/relocations/runs/$uuid/findings/"
    paths: ["/workspace/findings/**"]
timeout: 2400s
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
      - "--findings-file"
      - "/findings/import-$jsonfile"
      - "--decrypt-with-gcp-kms"
      - "/in/kms-config.json"
      $args
    timeout: 30s
    """
)

# TODO(getsentry/team-ospo#203): Encrypt outgoing as well.
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
      - "/workspace/out:/out"
      - "-v"
      - "/workspace/findings:/findings"
      - "-e"
      - "SENTRY_LOG_LEVEL=CRITICAL"
      - "web"
      - "export"
      - "$scope"
      - "/out/$jsonfile"
      - "--findings-file"
      - "/findings/export-$jsonfile"
      $args
    timeout: 30s
    """
)

# TODO(getsentry/team-ospo#203): Encrypt right side as well.
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
      - "/out/$jsonfile"
      - "--findings-file"
      - "/findings/compare-$jsonfile"
      - "--decrypt-left-with-gcp-kms"
      - "/in/kms-config.json"
      $args
    timeout: 30s
    """
)


def start_relocation_task(
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
        relocation.latest_task_attempts = 1

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
def get_bucket_name():
    """
    When using the local FileSystemStorage (ie, in tests), we use a contrived bucket name, since
    this is really just an alias for a bespoke local directory in that case.
    """

    storage = get_storage()
    return "default" if getattr(storage, "bucket_name", None) is None else storage.bucket_name


def create_cloudbuild_yaml(relocation: Relocation) -> bytes:
    # Only test existing users for collision and mutation.
    existing_usernames = User.objects.filter(username__in=relocation.want_usernames).values_list(
        "username", flat=True
    )
    filter_usernames_args = [
        "--filter-usernames",
        ",".join(existing_usernames) if existing_usernames else ",",
    ]
    filter_org_slugs_args = ["--filter-org-slugs", ",".join(relocation.want_org_slugs)]
    bucket_root = f"gs://{get_bucket_name()}"

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
        # TODO(getsentry/team-ospo#203): Add compare-raw-relocation-data as well.
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
