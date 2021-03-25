import os
from datetime import timedelta
from uuid import uuid4

import click
from django.utils import timezone

from sentry.runner.decorators import log_options

# allows services like tagstore to add their own (abstracted) models
# to cleanup
EXTRA_BULK_QUERY_DELETES = []


def get_project(value):
    from sentry.models import Project

    try:
        if value.isdigit():
            return int(value)
        if "/" not in value:
            return None
        org, proj = value.split("/", 1)
        return Project.objects.get(organization__slug=org, slug=proj).id
    except Project.DoesNotExist:
        return None


# We need a unique value to indicate when to stop multiprocessing queue
# an identity on an object() isn't guaranteed to work between parent
# and child proc
_STOP_WORKER = "91650ec271ae4b3e8a67cdc909d80f8c"

API_TOKEN_TTL_IN_DAYS = 30


def multiprocess_worker(task_queue):
    # Configure within each Process
    import logging

    from sentry.utils.imports import import_string

    logger = logging.getLogger("sentry.cleanup")

    configured = False

    while True:
        j = task_queue.get()
        if j == _STOP_WORKER:
            task_queue.task_done()
            return

        # On first task, configure Sentry environment
        if not configured:
            from sentry.runner import configure

            configure()

            from sentry import deletions, models, similarity

            skip_models = [
                # Handled by other parts of cleanup
                models.EventAttachment,
                models.UserReport,
                models.Group,
                models.GroupEmailThread,
                models.GroupRuleStatus,
                # Handled by TTL
                similarity,
            ] + [b[0] for b in EXTRA_BULK_QUERY_DELETES]

            configured = True

        model, chunk = j
        model = import_string(model)

        try:
            task = deletions.get(
                model=model,
                query={"id__in": chunk},
                skip_models=skip_models,
                transaction_id=uuid4().hex,
            )

            while True:
                if not task.chunk():
                    break
        except Exception as e:
            logger.exception(e)
        finally:
            task_queue.task_done()


@click.command()
@click.option("--days", default=30, show_default=True, help="Numbers of days to truncate on.")
@click.option("--project", help="Limit truncation to only entries from project.")
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
@click.option(
    "--timed",
    "-t",
    default=False,
    is_flag=True,
    help="Send the duration of this command to internal metrics.",
)
@log_options()
def cleanup(days, project, concurrency, silent, model, router, timed):
    """Delete a portion of trailing data based on creation date.

    All data that is older than `--days` will be deleted.  The default for
    this is 30 days.  In the default setting all projects will be truncated
    but if you have a specific project you want to limit this to this can be
    done with the `--project` flag which accepts a project ID or a string
    with the form `org/project` where both are slugs.
    """
    if concurrency < 1:
        click.echo("Error: Minimum concurrency is 1", err=True)
        raise click.Abort()

    os.environ["_SENTRY_CLEANUP"] = "1"

    # Make sure we fork off multiprocessing pool
    # before we import or configure the app
    from multiprocessing import JoinableQueue as Queue
    from multiprocessing import Process

    pool = []
    task_queue = Queue(1000)
    for _ in range(concurrency):
        p = Process(target=multiprocess_worker, args=(task_queue,))
        p.daemon = True
        p.start()
        pool.append(p)

    from sentry.runner import configure

    configure()

    from django.db import router as db_router

    from sentry import models
    from sentry.app import nodestore
    from sentry.data_export.models import ExportedData
    from sentry.db.deletion import BulkDeleteQuery

    if timed:
        import time

        from sentry.utils import metrics

        start_time = time.time()

    # list of models which this query is restricted to
    model_list = {m.lower() for m in model}

    def is_filtered(model):
        if router is not None and db_router.db_for_write(model) != router:
            return True
        if not model_list:
            return False
        return model.__name__.lower() not in model_list

    # Deletions that use `BulkDeleteQuery` (and don't need to worry about child relations)
    # (model, datetime_field, order_by)
    BULK_QUERY_DELETES = [
        (models.UserReport, "date_added", None),
        (models.GroupEmailThread, "date", None),
        (models.GroupRuleStatus, "date_added", None),
    ] + EXTRA_BULK_QUERY_DELETES

    # Deletions that use the `deletions` code path (which handles their child relations)
    # (model, datetime_field, order_by)
    DELETES = [
        (models.EventAttachment, "date_added", "date_added"),
        (models.Group, "last_seen", "last_seen"),
    ]

    if not silent:
        click.echo("Removing expired values for LostPasswordHash")

    if is_filtered(models.LostPasswordHash):
        if not silent:
            click.echo(">> Skipping LostPasswordHash")
    else:
        models.LostPasswordHash.objects.filter(
            date_added__lte=timezone.now() - timedelta(hours=48)
        ).delete()

    if not silent:
        click.echo("Removing expired values for OrganizationMember")

    if is_filtered(models.OrganizationMember):
        if not silent:
            click.echo(">> Skipping OrganizationMember")
    else:
        expired_threshold = timezone.now() - timedelta(days=days)
        models.OrganizationMember.delete_expired(expired_threshold)

    for model in [models.ApiGrant, models.ApiToken]:
        if not silent:
            click.echo(f"Removing expired values for {model.__name__}")

        if is_filtered(model):
            if not silent:
                click.echo(f">> Skipping {model.__name__}")
        else:
            queryset = model.objects.filter(
                expires_at__lt=(timezone.now() - timedelta(days=API_TOKEN_TTL_IN_DAYS))
            )

            # SentryAppInstallations are associated to ApiTokens. We're okay
            # with these tokens sticking around so that the Integration can
            # refresh them, but all other non-associated tokens should be
            # deleted.
            if model is models.ApiToken:
                queryset = queryset.filter(sentry_app_installation__isnull=True)

            queryset.delete()

    if not silent:
        click.echo("Removing expired files associated with ExportedData")

    if is_filtered(ExportedData):
        if not silent:
            click.echo(">> Skipping ExportedData files")
    else:
        queryset = ExportedData.objects.filter(date_expired__lt=(timezone.now()))
        for item in queryset:
            item.delete_file()

    project_id = None
    if project:
        click.echo("Bulk NodeStore deletion not available for project selection", err=True)
        project_id = get_project(project)
        if project_id is None:
            click.echo("Error: Project not found", err=True)
            raise click.Abort()
    else:
        if not silent:
            click.echo("Removing old NodeStore values")

        cutoff = timezone.now() - timedelta(days=days)
        try:
            nodestore.cleanup(cutoff)
        except NotImplementedError:
            click.echo("NodeStore backend does not support cleanup operation", err=True)

    for bqd in BULK_QUERY_DELETES:
        if len(bqd) == 4:
            model, dtfield, order_by, chunk_size = bqd
        else:
            chunk_size = 10000
            model, dtfield, order_by = bqd

        if not silent:
            click.echo(
                "Removing {model} for days={days} project={project}".format(
                    model=model.__name__, days=days, project=project or "*"
                )
            )
        if is_filtered(model):
            if not silent:
                click.echo(">> Skipping %s" % model.__name__)
        else:
            BulkDeleteQuery(
                model=model, dtfield=dtfield, days=days, project_id=project_id, order_by=order_by
            ).execute(chunk_size=chunk_size)

    for model, dtfield, order_by in DELETES:
        if not silent:
            click.echo(
                "Removing {model} for days={days} project={project}".format(
                    model=model.__name__, days=days, project=project or "*"
                )
            )

        if is_filtered(model):
            if not silent:
                click.echo(">> Skipping %s" % model.__name__)
        else:
            imp = ".".join((model.__module__, model.__name__))

            q = BulkDeleteQuery(
                model=model, dtfield=dtfield, days=days, project_id=project_id, order_by=order_by
            )

            for chunk in q.iterator(chunk_size=100):
                task_queue.put((imp, chunk))

            task_queue.join()

    # Clean up FileBlob instances which are no longer used and aren't super
    # recent (as there could be a race between blob creation and reference)
    if not silent:
        click.echo("Cleaning up unused FileBlob references")
    if is_filtered(models.FileBlob):
        if not silent:
            click.echo(">> Skipping FileBlob")
    else:
        cleanup_unused_files(silent)

    # Shut down our pool
    for _ in pool:
        task_queue.put(_STOP_WORKER)

    # And wait for it to drain
    for p in pool:
        p.join()

    if timed:
        duration = int(time.time() - start_time)
        metrics.timing("cleanup.duration", duration, instance=router, sample_rate=1.0)
        click.echo("Clean up took %s second(s)." % duration)


def cleanup_unused_files(quiet=False):
    """
    Remove FileBlob's (and thus the actual files) if they are no longer
    referenced by any File.

    We set a minimum-age on the query to ensure that we don't try to remove
    any blobs which are brand new and potentially in the process of being
    referenced.
    """
    from sentry.models import File, FileBlob, FileBlobIndex

    if quiet:
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
