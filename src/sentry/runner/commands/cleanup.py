from __future__ import annotations

import functools
import logging
import os
import time
from collections.abc import Callable, Sequence
from datetime import timedelta
from multiprocessing import JoinableQueue as Queue
from multiprocessing import Process
from typing import TYPE_CHECKING, Any, Final, Literal, TypeAlias, TypeVar
from uuid import uuid4

import click
import sentry_sdk
from django.conf import settings
from django.db import router as db_router
from django.db.models import QuerySet
from django.utils import timezone
from sentry_sdk import capture_exception

from sentry.runner.decorators import log_options
from sentry.silo.base import SiloLimit, SiloMode

logger = logging.getLogger(__name__)

TRANSACTION_PREFIX = "cleanup"
DELETES_BY_PROJECT_CHUNK_SIZE = 100

if TYPE_CHECKING:
    from sentry.db.deletion import BulkDeleteQuery
    from sentry.db.models.base import BaseModel

    # TypeVar for concrete subclasses of BaseModel
    ModelT = TypeVar("ModelT", bound=BaseModel)


class CleanupExecutionAborted(Exception):
    """
    Exception raised when the cleanup process should be aborted.
    """


def get_project(value: str) -> int | None:
    from sentry.models.project import Project

    try:
        if value.isdigit():
            return int(value)
        if "/" not in value:
            return None
        org, proj = value.split("/", 1)
        return Project.objects.get(organization__slug=org, slug=proj).id
    except Project.DoesNotExist:
        return None


def get_organization(value: str) -> int | None:
    from sentry.models.organization import Organization

    try:
        if value.isdigit():
            return int(value)
        return Organization.objects.get(slug=value).id
    except Organization.DoesNotExist:
        return None


# We need a unique value to indicate when to stop multiprocessing queue
# an identity on an object() isn't guaranteed to work between parent
# and child proc
_STOP_WORKER: Final = "91650ec271ae4b3e8a67cdc909d80f8c"
_WorkQueue: TypeAlias = (
    "Queue[Literal['91650ec271ae4b3e8a67cdc909d80f8c'] | tuple[str, tuple[int, ...], int | None]]"
)

API_TOKEN_TTL_IN_DAYS = 30


def debug_output(msg: str) -> None:
    if os.environ.get("SENTRY_CLEANUP_SILENT", None):
        return
    click.echo(msg)


def _format_chunk_ids(chunk: tuple[int, ...]) -> str:
    """Format chunk IDs for logging: show all if small, or first/last if large."""
    if len(chunk) == 0:
        return "[]"
    elif len(chunk) <= 10:
        return str(list(chunk))
    else:
        return f"[{chunk[0]}, ..., {chunk[-1]}] ({len(chunk)} total)"


def multiprocess_worker(task_queue: _WorkQueue) -> None:
    # Configure within each Process
    import logging

    logger = logging.getLogger("sentry.cleanup")

    from sentry.runner import configure

    configure()

    from sentry import options
    from sentry.utils import metrics

    while True:
        j = task_queue.get()
        if j == _STOP_WORKER:
            task_queue.task_done()
            return

        # Handle both old format (model_name, chunk) and new format (model_name, chunk, project_id)
        if len(j) == 2:
            model_name, chunk = j  # type: ignore[unreachable]
            project_id = None
        else:
            model_name, chunk, project_id = j

        if options.get("cleanup.abort_execution"):
            logger.warning("Cleanup worker aborting due to cleanup.abort_execution flag")
            task_queue.task_done()
            return

        try:
            with sentry_sdk.start_transaction(
                op="cleanup", name=f"{TRANSACTION_PREFIX}.multiprocess_worker"
            ):
                task_execution(model_name, chunk, project_id)
        except Exception:
            metrics.incr(
                "cleanup.error",
                instance=model_name,
                tags={"model": model_name, "type": "multiprocess_worker"},
                sample_rate=1.0,
            )
            ids_str = _format_chunk_ids(chunk)
            if os.environ.get("SENTRY_CLEANUP_SILENT", None):
                tags: dict[str, Any] = {
                    "model": model_name,
                    "chunk_size": len(chunk),
                    "chunk_ids": ids_str,
                }
                if project_id is not None:
                    tags["project_id"] = project_id
                capture_exception(tags=tags)
            else:
                logger.exception(
                    "Error processing chunk of %s objects (IDs: %s project_id=%s)",
                    model_name,
                    ids_str,
                    project_id,
                )
        finally:
            task_queue.task_done()


def task_execution(model_name: str, chunk: tuple[int, ...], project_id: int | None) -> None:
    """
    Execute deletion for a chunk of objects.

    Logs:
    - Start: how many objects are about to be processed
    - Each iteration: progress through the deletion task
    - End: completion summary
    """
    from sentry import deletions, models, similarity
    from sentry.utils import metrics
    from sentry.utils.imports import import_string

    skip_child_relations_models = [
        # Handled by other parts of cleanup
        models.EventAttachment,
        models.UserReport,
        models.Group,
        models.GroupEmailThread,
        models.GroupRuleStatus,
        # Handled by TTL
        similarity,
    ]

    ids_str = _format_chunk_ids(chunk)
    chunk_size = len(chunk)

    # Log start of chunk processing
    debug_output(
        f"[START] Processing {chunk_size} {model_name} objects (IDs: {ids_str} project_id={project_id})"
    )

    model = import_string(model_name)
    task = deletions.get(
        model=model,
        query={"id__in": chunk},
        skip_models=skip_child_relations_models,
        transaction_id=uuid4().hex,
    )

    # Track deletion iterations (task.chunk() may need multiple calls to fully delete)
    iteration = 0
    while True:
        iteration += 1
        has_more = task.chunk(apply_filter=True)

        debug_output(
            f"[ITERATION {iteration}] {model_name} chunk (project_id={project_id} has_more={has_more})"
        )

        if not has_more:
            break

    # Increment metric once per chunk, after all iterations complete
    metrics.incr("cleanup.chunk_processed", tags={"model": model_name}, amount=chunk_size)

    # Log completion
    debug_output(
        f"[COMPLETE] Finished {chunk_size} {model_name} objects in {iteration} iteration(s) (IDs: {ids_str} project_id={project_id})"
    )


@click.command()
@click.option("--days", default=30, show_default=True, help="Numbers of days to truncate on.")
@click.option("--project", help="Limit truncation to only entries from project.")
@click.option("--organization", help="Limit truncation to only entries from organization.")
@click.option(
    "--concurrency",
    type=int,
    default=1,
    show_default=True,
    help="The total number of concurrent worker processes to run.",
)
@click.option(
    "--silent", "-q", default=False, is_flag=True, help="Run quietly. No output on success."
)
@click.option("--model", "-m", multiple=True)
@click.option("--router", "-r", default=None, help="Database router")
@log_options()
def cleanup(
    days: int,
    project: str | None,
    organization: str | None,
    concurrency: int,
    silent: bool,
    model: tuple[str, ...],
    router: str | None,
) -> None:
    """Delete a portion of trailing data based on creation date.

    All data that is older than `--days` will be deleted.  The default for
    this is 30 days.  In the default setting all projects will be truncated
    but if you have a specific project or organization you want to limit this to,
    this can be done with the `--project` or `--organization` flags respectively,
    which accepts a project/organization ID or a string with the form `org/project` where both are slugs.
    """
    _cleanup(
        model=model,
        days=days,
        concurrency=concurrency,
        silent=silent,
        router=router,
        project=project,
        organization=organization,
    )


def _cleanup(
    model: tuple[str, ...],
    days: int,
    concurrency: int,
    silent: bool,
    router: str | None,
    project: str | None = None,
    organization: str | None = None,
    start_from_project_id: int | None = None,
) -> None:
    start_time = time.time()
    _validate_and_setup_environment(concurrency, silent)
    # Make sure we fork off multiprocessing pool
    # before we import or configure the app
    pool, task_queue = _start_pool(concurrency)

    from sentry.runner import configure

    if not settings.configured:
        configure()

    from sentry import options
    from sentry.utils import metrics

    # Start transaction AFTER creating the multiprocessing pool to avoid
    # transaction context issues in child processes. This ensures only the
    # main process tracks the overall cleanup operation performance.
    with sentry_sdk.start_transaction(
        op="cleanup", name=f"{TRANSACTION_PREFIX}.main"
    ) as transaction:
        try:
            # Check if cleanup should be aborted before starting
            if options.get("cleanup.abort_execution"):
                raise CleanupExecutionAborted()

            # list of models which this query is restricted to
            model_list = {m.lower() for m in model}
            # Track which models were attempted for deletion
            models_attempted: set[str] = set()
            # Track which models were filtered out for legitimate reasons (silo/router)
            models_legitimately_filtered: set[str] = set()

            def is_filtered(model: type[BaseModel]) -> bool:
                model_name = model.__name__.lower()
                silo_limit = getattr(model._meta, "silo_limit", None)
                if isinstance(silo_limit, SiloLimit) and not silo_limit.is_available():
                    models_legitimately_filtered.add(model_name)
                    return True
                if router is not None and db_router.db_for_write(model) != router:
                    models_legitimately_filtered.add(model_name)
                    return True
                if not model_list:
                    return False
                return model.__name__.lower() not in model_list

            deletes = models_which_use_deletions_code_path()

            _run_specialized_cleanups(is_filtered, days, models_attempted)

            # Handle project/organization specific logic
            project_id, organization_id = _handle_project_organization_cleanup(
                project, organization, days, deletes
            )
            if organization_id is not None:
                transaction.set_tag("organization_id", organization_id)
            if project_id is not None:
                transaction.set_tag("project_id", project_id)

            run_bulk_query_deletes(
                is_filtered,
                days,
                project,
                project_id,
                models_attempted,
            )

            run_bulk_deletes_in_deletes(
                task_queue,
                deletes,
                is_filtered,
                days,
                project,
                project_id,
                models_attempted,
            )

            run_bulk_deletes_by_project(
                task_queue, project_id, start_from_project_id, is_filtered, days, models_attempted
            )

            run_bulk_deletes_by_organization(
                task_queue, organization_id, is_filtered, days, models_attempted
            )

            remove_file_blobs(is_filtered, models_attempted)
        except CleanupExecutionAborted:
            click.echo("Cleanup was aborted via cleanup.abort_execution option.")
            metrics.incr(
                "cleanup.aborted", instance=router, tags={"db_router": router}, sample_rate=1.0
            )
            capture_exception(tags={"db_router": router})
            # Don't re-raise - this is expected behavior, not an error
        except Exception:
            capture_exception(tags={"db_router": router})
            metrics.incr(
                "cleanup.error", tags={"db_router": router, "type": "FATAL"}, sample_rate=1.0
            )
            raise

        finally:
            # Shut down our pool
            _stop_pool(pool, task_queue)

            duration = int(time.time() - start_time)
            metrics.timing(
                "cleanup.duration",
                duration,
                instance=router,
                tags={"db_router": router},
                sample_rate=1.0,
            )
            click.echo("Clean up took %s second(s)." % duration)

            # Check for models that were specified but never attempted
            if model_list:
                _report_models_never_attempted(
                    model_list, models_attempted, models_legitimately_filtered
                )


def continue_on_error(metric_type: str) -> Callable[..., Any]:
    """
    Decorator that catches exceptions, tracks metrics, and continues execution.

    Does NOT catch CleanupExecutionAborted - that exception is allowed to propagate
    so the cleanup can be properly aborted.

    Args:
        metric_type: The type tag for the cleanup.error metric

    Example:
        @continue_on_error("specialized_cleanup_lost_passwords")
        def remove_expired_values_for_lost_passwords(is_filtered, models_attempted):
            ...
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return func(*args, **kwargs)
            except CleanupExecutionAborted:
                # Don't catch abort exceptions - let them propagate
                raise
            except Exception:
                from sentry.utils import metrics

                capture_exception()
                metrics.incr("cleanup.error", tags={"type": metric_type}, sample_rate=1.0)

        return wrapper

    return decorator


def _validate_and_setup_environment(concurrency: int, silent: bool) -> None:
    """Validate input parameters and set up environment variables."""
    if concurrency < 1:
        click.echo("Error: Minimum concurrency is 1", err=True)
        raise click.Abort()

    os.environ["_SENTRY_CLEANUP"] = "1"
    if silent:
        os.environ["SENTRY_CLEANUP_SILENT"] = "1"


def _run_specialized_cleanups(
    is_filtered: Callable[[type[BaseModel]], bool],
    days: int,
    models_attempted: set[str],
) -> None:
    """Run specialized cleanup operations for specific models."""
    from sentry import options

    if options.get("cleanup.abort_execution"):
        raise CleanupExecutionAborted()

    remove_expired_values_for_lost_passwords(is_filtered, models_attempted)
    remove_expired_values_for_org_members(is_filtered, days, models_attempted)
    delete_api_models(is_filtered, models_attempted)
    exported_data(is_filtered, models_attempted)


def _handle_project_organization_cleanup(
    project: str | None,
    organization: str | None,
    days: int,
    deletes: list[tuple[type[BaseModel], str, str]],
) -> tuple[int | None, int | None]:
    """Handle project/organization specific cleanup logic."""
    project_id = None
    organization_id = None

    if SiloMode.get_current_mode() != SiloMode.CONTROL:
        if project:
            remove_cross_project_models(deletes)
            project_id = get_project_id_or_fail(project)
        elif organization:
            organization_id = get_organization_id_or_fail(organization)
        else:
            remove_old_nodestore_values(days)

    return project_id, organization_id


def _report_models_never_attempted(
    model_list: set[str], models_attempted: set[str], models_legitimately_filtered: set[str]
) -> None:
    # Exclude models that were legitimately filtered out (silo/router restrictions)
    models_never_attempted = model_list - models_attempted - models_legitimately_filtered
    if models_never_attempted:
        logger.warning(
            "Models specified with --model were never attempted for deletion, must configure cleanup for this model",
            extra={
                "models_never_attempted": sorted(models_never_attempted),
                "legitimately_filtered_models": (
                    sorted(models_legitimately_filtered) if models_legitimately_filtered else None
                ),
            },
        )


def _start_pool(concurrency: int) -> tuple[list[Process], _WorkQueue]:
    pool: list[Process] = []
    task_queue: _WorkQueue = Queue(1000)
    for _ in range(concurrency):
        p = Process(target=multiprocess_worker, args=(task_queue,))
        p.daemon = True
        p.start()
        pool.append(p)
    return pool, task_queue


def _stop_pool(pool: Sequence[Process], task_queue: _WorkQueue) -> None:
    # First, ensure all queued tasks are completed
    task_queue.join()

    # Stop the pool
    for _ in pool:
        task_queue.put(_STOP_WORKER)
    # And wait for it to drain
    for p in pool:
        p.join()


@continue_on_error("specialized_cleanup_lost_passwords")
def remove_expired_values_for_lost_passwords(
    is_filtered: Callable[[type[BaseModel]], bool], models_attempted: set[str]
) -> None:
    from sentry.users.models.lostpasswordhash import LostPasswordHash

    if is_filtered(LostPasswordHash):
        debug_output(">> Skipping LostPasswordHash")
    else:
        debug_output("Removing expired values for LostPasswordHash")
        models_attempted.add(LostPasswordHash.__name__.lower())
        LostPasswordHash.objects.filter(
            date_added__lte=timezone.now() - timedelta(hours=48)
        ).delete()


@continue_on_error("specialized_cleanup_org_members")
def remove_expired_values_for_org_members(
    is_filtered: Callable[[type[BaseModel]], bool], days: int, models_attempted: set[str]
) -> None:
    from sentry.models.organizationmember import OrganizationMember

    if is_filtered(OrganizationMember):
        debug_output(">> Skipping OrganizationMember")
    else:
        debug_output("Removing expired values for OrganizationMember")
        models_attempted.add(OrganizationMember.__name__.lower())
        expired_threshold = timezone.now() - timedelta(days=days)
        OrganizationMember.objects.delete_expired(expired_threshold)


@continue_on_error("specialized_cleanup_api_models")
def delete_api_models(
    is_filtered: Callable[[type[BaseModel]], bool], models_attempted: set[str]
) -> None:
    from sentry.models.apidevicecode import ApiDeviceCode
    from sentry.models.apigrant import ApiGrant
    from sentry.models.apitoken import ApiToken

    for model_tp in (ApiGrant, ApiToken):
        if is_filtered(model_tp):
            debug_output(f">> Skipping {model_tp.__name__}")
        else:
            debug_output(f"Removing expired values for {model_tp.__name__}")
            models_attempted.add(model_tp.__name__.lower())
            queryset = model_tp.objects.filter(
                expires_at__lt=(timezone.now() - timedelta(days=API_TOKEN_TTL_IN_DAYS))
            )

            # SentryAppInstallations are associated to ApiTokens. We're okay
            # with these tokens sticking around so that the Integration can
            # refresh them, but all other non-associated tokens should be
            # deleted.
            if model_tp is ApiToken:
                queryset = queryset.filter(sentry_app_installation__isnull=True)

            queryset.delete()

    # Device codes have short expiration times (10 minutes), so clean up
    # any that have expired immediately without additional TTL buffer.
    if is_filtered(ApiDeviceCode):
        debug_output(">> Skipping ApiDeviceCode")
    else:
        debug_output("Removing expired values for ApiDeviceCode")
        models_attempted.add(ApiDeviceCode.__name__.lower())
        ApiDeviceCode.objects.filter(expires_at__lt=timezone.now()).delete()


@continue_on_error("specialized_cleanup_exported_data")
def exported_data(
    is_filtered: Callable[[type[BaseModel]], bool], models_attempted: set[str]
) -> None:
    from sentry.data_export.models import ExportedData

    if is_filtered(ExportedData):
        debug_output(">> Skipping ExportedData files")
    else:
        debug_output("Removing expired files associated with ExportedData")
        models_attempted.add(ExportedData.__name__.lower())
        export_data_queryset = ExportedData.objects.filter(date_expired__lt=(timezone.now()))
        for item in export_data_queryset:
            item.delete_file()


def models_which_use_deletions_code_path() -> list[tuple[type[BaseModel], str, str]]:
    from sentry.models.artifactbundle import ArtifactBundle
    from sentry.models.commit import Commit
    from sentry.models.eventattachment import EventAttachment
    from sentry.models.files.file import File
    from sentry.models.grouprulestatus import GroupRuleStatus
    from sentry.models.pullrequest import PullRequest
    from sentry.models.release import Release
    from sentry.models.rulefirehistory import RuleFireHistory
    from sentry.monitors.models import MonitorCheckIn
    from sentry.preprod.models import PreprodArtifact
    from sentry.replays.models import ReplayRecordingSegment

    # Deletions that use the `deletions` code path (which handles their child relations)
    # (model, datetime_field, order_by)
    return [
        (EventAttachment, "date_added", "date_added"),
        (ReplayRecordingSegment, "date_added", "date_added"),
        (ArtifactBundle, "date_added", "date_added"),
        (MonitorCheckIn, "date_added", "date_added"),
        (GroupRuleStatus, "date_added", "date_added"),
        (PreprodArtifact, "date_added", "date_added"),
        (PullRequest, "date_added", "date_added"),
        (RuleFireHistory, "date_added", "date_added"),
        (Release, "date_added", "date_added"),
        (File, "timestamp", "id"),
        (Commit, "date_added", "id"),
    ]


def remove_cross_project_models(
    deletes: list[tuple[type[BaseModel], str, str]],
) -> list[tuple[type[BaseModel], str, str]]:
    from sentry.models.artifactbundle import ArtifactBundle
    from sentry.models.files.file import File

    # These models span across projects, so let's skip them
    deletes.remove((ArtifactBundle, "date_added", "date_added"))
    deletes.remove((File, "timestamp", "id"))
    return deletes


def get_project_id_or_fail(project: str) -> int:
    click.echo("Bulk NodeStore deletion not available for project selection", err=True)
    project_id = get_project(project)
    if project_id is None:
        click.echo("Error: Project not found", err=True)
        raise click.Abort()
    return project_id


def get_organization_id_or_fail(organization: str) -> int:
    click.echo("Bulk NodeStore deletion not available for organization selection", err=True)
    organization_id = get_organization(organization)
    if organization_id is None:
        click.echo("Error: Organization not found", err=True)
        raise click.Abort()
    return organization_id


@continue_on_error("nodestore_cleanup")
def remove_old_nodestore_values(days: int) -> None:
    from sentry import nodestore, options

    debug_output("Removing old NodeStore values")

    if options.get("cleanup.abort_execution"):
        raise CleanupExecutionAborted()

    cutoff = timezone.now() - timedelta(days=days)
    try:
        nodestore.backend.cleanup(cutoff)
    except NotImplementedError:
        click.echo("NodeStore backend does not support cleanup operation", err=True)


def generate_bulk_query_deletes() -> list[tuple[type[BaseModel], str, str | None]]:
    from django.apps import apps

    from sentry.models.groupemailthread import GroupEmailThread
    from sentry.models.userreport import UserReport

    # Deletions that use `BulkDeleteQuery` (and don't need to worry about child relations)
    # (model, datetime_field, order_by)
    additional_bulk_query_deletes = []
    for entry in settings.ADDITIONAL_BULK_QUERY_DELETES:
        app_name, model_name = entry[0].split(".")
        model_tp = apps.get_model(app_name, model_name)
        additional_bulk_query_deletes.append((model_tp, entry[1], entry[2]))

    BULK_QUERY_DELETES = [
        (UserReport, "date_added", None),
        (GroupEmailThread, "date", None),
    ] + additional_bulk_query_deletes

    return BULK_QUERY_DELETES


def run_bulk_query_deletes(
    is_filtered: Callable[[type[BaseModel]], bool],
    days: int,
    project: str | None,
    project_id: int | None,
    models_attempted: set[str],
) -> None:
    from sentry import options
    from sentry.db.deletion import BulkDeleteQuery
    from sentry.utils import metrics

    if options.get("cleanup.abort_execution"):
        raise CleanupExecutionAborted()

    debug_output("Running bulk query deletes in bulk_query_deletes")
    bulk_query_deletes = generate_bulk_query_deletes()
    for model_tp, dtfield, order_by in bulk_query_deletes:
        chunk_size = 10000

        if is_filtered(model_tp):
            debug_output(">> Skipping %s" % model_tp.__name__)
        else:
            debug_output(f"Removing {model_tp.__name__} for days={days} project={project or '*'}")
            models_attempted.add(model_tp.__name__.lower())
            try:
                BulkDeleteQuery(
                    model=model_tp,
                    dtfield=dtfield,
                    days=days,
                    project_id=project_id,
                    order_by=order_by,
                ).execute(chunk_size=chunk_size)
            except Exception:
                capture_exception(tags={"model": model_tp.__name__})
                metrics.incr(
                    "cleanup.error",
                    instance=model_tp.__name__,
                    tags={"model": model_tp.__name__, "type": "bulk_delete_query"},
                    sample_rate=1.0,
                )


def _schedule_bulk_delete_chunks(
    task_queue: _WorkQueue,
    q: BulkDeleteQuery,  # Imported locally in functions that use it
    model_tp: type[BaseModel],
    project_id: int | None,
    context_str: str = "",
) -> tuple[int, int]:
    """
    Schedule chunks from a BulkDeleteQuery into the task queue.

    Returns:
        Tuple of (chunk_count, total_objects)
    """
    imp = ".".join((model_tp.__module__, model_tp.__name__))
    chunk_count = 0
    total_objects = 0

    for chunk in q.iterator(chunk_size=DELETES_BY_PROJECT_CHUNK_SIZE):
        task_queue.put((imp, chunk, project_id))
        chunk_count += 1
        total_objects += len(chunk)

    if chunk_count > 0:
        debug_output(
            f"[SCHEDULED] {chunk_count} chunks ({total_objects} total {model_tp.__name__} objects project_id={project_id}{context_str})"
        )
    else:
        debug_output(
            f"[SCHEDULED] No {model_tp.__name__} objects found to delete (project_id={project_id}{context_str})"
        )

    return chunk_count, total_objects


def run_bulk_deletes_in_deletes(
    task_queue: _WorkQueue,
    deletes: list[tuple[type[BaseModel], str, str]],
    is_filtered: Callable[[type[BaseModel]], bool],
    days: int,
    project: str | None,
    project_id: int | None,
    models_attempted: set[str],
) -> None:
    from sentry import options
    from sentry.db.deletion import BulkDeleteQuery
    from sentry.utils import metrics

    if options.get("cleanup.abort_execution"):
        raise CleanupExecutionAborted()

    debug_output("Running bulk deletes in DELETES")
    for model_tp, dtfield, order_by in deletes:
        if is_filtered(model_tp):
            debug_output(">> Skipping %s" % model_tp.__name__)
        else:
            debug_output(f"Removing {model_tp.__name__} for days={days} project={project or '*'}")
            models_attempted.add(model_tp.__name__.lower())
            try:
                q = BulkDeleteQuery(
                    model=model_tp,
                    dtfield=dtfield,
                    days=days,
                    project_id=project_id,
                    order_by=order_by,
                )
                _schedule_bulk_delete_chunks(task_queue, q, model_tp, project_id)

            except Exception:
                capture_exception(tags={"model": model_tp.__name__})
                metrics.incr(
                    "cleanup.error",
                    instance=model_tp.__name__,
                    tags={"model": model_tp.__name__, "type": "bulk_delete_in_deletes"},
                    sample_rate=1.0,
                )

    # Ensure all tasks are completed before exiting
    task_queue.join()


def run_bulk_deletes_by_project(
    task_queue: _WorkQueue,
    project_id: int | None,
    start_from_project_id: int | None,
    is_filtered: Callable[[type[BaseModel]], bool],
    days: int,
    models_attempted: set[str],
) -> None:
    from sentry import options
    from sentry.db.deletion import BulkDeleteQuery
    from sentry.utils import metrics
    from sentry.utils.query import RangeQuerySetWrapper

    if options.get("cleanup.abort_execution"):
        raise CleanupExecutionAborted()

    project_deletion_query, to_delete_by_project = prepare_deletes_by_project(
        is_filtered, project_id, start_from_project_id
    )

    if project_deletion_query is not None and len(to_delete_by_project):
        debug_output("Running bulk deletes in DELETES_BY_PROJECT")

        for project_id_for_deletion in RangeQuerySetWrapper(
            project_deletion_query.values_list("id", flat=True),
            result_value_getter=lambda item: item,
        ):
            for model_tp, dtfield, order_by in to_delete_by_project:
                models_attempted.add(model_tp.__name__.lower())
                debug_output(
                    f"Removing {model_tp.__name__} for days={days} project={project_id_for_deletion}"
                )

                try:
                    q = BulkDeleteQuery(
                        model=model_tp,
                        dtfield=dtfield,
                        days=days,
                        project_id=project_id_for_deletion,
                        order_by=order_by,
                    )

                    _schedule_bulk_delete_chunks(task_queue, q, model_tp, project_id_for_deletion)
                except Exception:
                    capture_exception(
                        tags={"model": model_tp.__name__, "project_id": project_id_for_deletion}
                    )
                    metrics.incr(
                        "cleanup.error",
                        instance=model_tp.__name__,
                        tags={"model": model_tp.__name__, "type": "bulk_delete_by_project"},
                        sample_rate=1.0,
                    )

    # Ensure all tasks are completed before exiting
    task_queue.join()


def run_bulk_deletes_by_organization(
    task_queue: _WorkQueue,
    organization_id: int | None,
    is_filtered: Callable[[type[BaseModel]], bool],
    days: int,
    models_attempted: set[str],
) -> None:
    from sentry import options
    from sentry.db.deletion import BulkDeleteQuery
    from sentry.utils import metrics
    from sentry.utils.query import RangeQuerySetWrapper

    if options.get("cleanup.abort_execution"):
        raise CleanupExecutionAborted()

    organization_deletion_query, to_delete_by_organization = prepare_deletes_by_organization(
        organization_id, is_filtered
    )

    if organization_deletion_query is not None and len(to_delete_by_organization):
        debug_output("Running bulk deletes in DELETES_BY_ORGANIZATION")
        for organization_id_for_deletion in RangeQuerySetWrapper(
            organization_deletion_query.values_list("id", flat=True),
            result_value_getter=lambda item: item,
        ):
            for model_tp, dtfield, order_by in to_delete_by_organization:
                models_attempted.add(model_tp.__name__.lower())
                debug_output(
                    f"Removing {model_tp.__name__} for days={days} organization={organization_id_for_deletion}"
                )
                try:
                    q = BulkDeleteQuery(
                        model=model_tp,
                        dtfield=dtfield,
                        days=days,
                        organization_id=organization_id_for_deletion,
                        order_by=order_by,
                    )
                    _schedule_bulk_delete_chunks(
                        task_queue,
                        q,
                        model_tp,
                        None,
                        context_str=f" organization_id={organization_id_for_deletion}",
                    )
                except Exception:
                    capture_exception(
                        tags={
                            "model": model_tp.__name__,
                            "organization_id": organization_id_for_deletion,
                        }
                    )
                    metrics.incr(
                        "cleanup.error",
                        instance=model_tp.__name__,
                        tags={"model": model_tp.__name__, "type": "bulk_delete_by_organization"},
                        sample_rate=1.0,
                    )

    # Ensure all tasks are completed before exiting
    task_queue.join()


def prepare_deletes_by_project(
    is_filtered: Callable[[type[BaseModel]], bool],
    project_id: int | None = None,
    start_from_project_id: int | None = None,
) -> tuple[QuerySet[Any] | None, list[tuple[Any, str, str]]]:
    from sentry.constants import ObjectStatus
    from sentry.models.debugfile import ProjectDebugFile
    from sentry.models.group import Group
    from sentry.models.project import Project

    # Deletions that we run per project. In some cases we can't use an index on just the date
    # column, so as an alternative we use `(project_id, <date_col>)` instead
    DELETES_BY_PROJECT: list[tuple[type[BaseModel], str, str]] = [
        # Having an index on `last_seen` sometimes caused the planner to make a bad plan that
        # used this index instead of a more appropriate one. This was causing a lot of postgres
        # load, so we had to remove it.
        (Group, "last_seen", "last_seen"),
        (ProjectDebugFile, "date_accessed", "date_accessed"),
    ]
    project_deletion_query = None
    to_delete_by_project = []
    if SiloMode.get_current_mode() != SiloMode.CONTROL:
        debug_output("Preparing DELETES_BY_PROJECT context")
        project_deletion_query = Project.objects.filter(status=ObjectStatus.ACTIVE)
        if project_id is not None:
            project_deletion_query = Project.objects.filter(id=project_id)
        elif start_from_project_id is not None:
            # When no specific project is provided, but a starting project ID is given,
            # filter to start from that project ID (inclusive)
            project_deletion_query = project_deletion_query.filter(id__gte=start_from_project_id)
            debug_output(f"Starting project iteration from project ID {start_from_project_id}")

        for model_tp_tup in DELETES_BY_PROJECT:
            if is_filtered(model_tp_tup[0]):
                debug_output(f">> Skipping {model_tp_tup[0].__name__}")
            else:
                to_delete_by_project.append(model_tp_tup)

    return project_deletion_query, to_delete_by_project


def prepare_deletes_by_organization(
    organization_id: int | None, is_filtered: Callable[[type[BaseModel]], bool]
) -> tuple[QuerySet[Any] | None, list[tuple[Any, str, str]]]:
    from sentry.constants import ObjectStatus
    from sentry.models.organization import Organization
    from sentry.models.releasefile import ReleaseFile

    # Deletions that we run per organization. In some cases we can't use an index on just the date
    # column, so as an alternative we use `(organization_id, <date_col>)` instead
    DELETES_BY_ORGANIZATION: list[tuple[type[BaseModel], str, str]] = [
        (ReleaseFile, "date_accessed", "date_accessed"),
    ]
    organization_deletion_query = None
    to_delete_by_organization = []
    if SiloMode.get_current_mode() != SiloMode.CONTROL:
        debug_output("Preparing DELETES_BY_ORGANIZATION context")
        organization_deletion_query = Organization.objects.filter(status=ObjectStatus.ACTIVE)
        if organization_id is not None:
            organization_deletion_query = Organization.objects.filter(id=organization_id)

        for model_tp_tup in DELETES_BY_ORGANIZATION:
            if is_filtered(model_tp_tup[0]):
                debug_output(f">> Skipping {model_tp_tup[0].__name__}")
            else:
                to_delete_by_organization.append(model_tp_tup)

    return organization_deletion_query, to_delete_by_organization


@continue_on_error("fileblob_cleanup")
def remove_file_blobs(
    is_filtered: Callable[[type[BaseModel]], bool], models_attempted: set[str]
) -> None:
    from sentry import options
    from sentry.models.file import FileBlob

    if options.get("cleanup.abort_execution"):
        raise CleanupExecutionAborted()

    # Clean up FileBlob instances which are no longer used and aren't super
    # recent (as there could be a race between blob creation and reference)
    if is_filtered(FileBlob):
        debug_output(">> Skipping FileBlob")
    else:
        debug_output("Cleaning up unused FileBlob references")
        models_attempted.add(FileBlob.__name__.lower())
        cleanup_unused_files()


def cleanup_unused_files() -> None:
    """
    Remove FileBlob's (and thus the actual files) if they are no longer
    referenced by any File.

    We set a minimum-age on the query to ensure that we don't try to remove
    any blobs which are brand new and potentially in the process of being
    referenced.
    """
    from sentry.models.files.file import File
    from sentry.models.files.fileblob import FileBlob
    from sentry.models.files.fileblobindex import FileBlobIndex

    if os.environ.get("SENTRY_CLEANUP_SILENT", None):
        from sentry.utils.query import RangeQuerySetWrapper
    else:
        from sentry.utils.query import RangeQuerySetWrapperWithProgressBar as RangeQuerySetWrapper

    cutoff = timezone.now() - timedelta(days=1)
    queryset = FileBlob.objects.filter(timestamp__lte=cutoff)

    for blob in RangeQuerySetWrapper(queryset):
        if FileBlobIndex.objects.filter(blob=blob).exists():
            continue
        if File.objects.filter(blob=blob).exists():
            continue
        blob.delete()
