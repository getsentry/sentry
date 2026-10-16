import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from time import monotonic

from django.db import connections, router
from django.db.models import Q
from django.db.models.functions import Coalesce
from psycopg2 import Error as PostgresError
from taskbroker_client.retry import Retry, RetryTaskError
from taskbroker_client.state import current_task
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry import features
from sentry.models.activity import Activity
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release, ReleaseStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.utils.db import statement_timeout

logger = logging.getLogger(__name__)

RESOLUTION_BATCH_SIZE = 100
RESOLUTION_BATCH_SECONDS = 3


@dataclass
class ResolutionBatchContext:
    phase: str = "candidate"
    project_id: int | None = None
    anchor_id: int | None = None


def _database_error_kind(exc: BaseException) -> str:
    cause = exc.__cause__
    if isinstance(cause, PostgresError):
        message = cause.diag.message_primary or ""
        if cause.pgcode == "57014" and "statement timeout" in message:
            return "statement_timeout"
        if cause.pgcode == "55P03" and "lock timeout" in message:
            return "lock_timeout"
    return "other"


def _report_batch_failure(
    exc: BaseException, release: Release, after_id: int, context: ResolutionBatchContext
) -> None:
    error = _database_error_kind(exc)
    tags = {"phase": context.phase, "error": error}
    metrics.incr("releases.resolution_batch.failed", tags=tags, sample_rate=1.0)
    extra = {
        "release_id": release.id,
        "organization_id": release.organization_id,
        "after_id": after_id,
        "phase": context.phase,
        "error": error,
        "project_id": context.project_id,
        "anchor_id": context.anchor_id,
    }
    if error != "other" or isinstance(exc, ProcessingDeadlineExceeded):
        logger.warning("releases.resolution_batch.failed", extra=extra)
    else:
        logger.exception("releases.resolution_batch.failed", extra=extra)
    task = current_task()
    if task is not None and not task.retries_remaining:
        metrics.incr("releases.resolution_batch.exhausted", tags=tags, sample_rate=1.0)
        # The task is discarded after its bounded retries. Keep enough context
        # to replay this cursor after the underlying failure has been addressed.
        logger.warning("releases.resolution_batch.exhausted", extra=extra)


@instrumented_task(
    name="sentry.tasks.clear_expired_resolutions",
    namespace=issues_tasks,
    processing_deadline_duration=15,
    retry=Retry(times=5, delay=30, on=(ProcessingDeadlineExceeded,)),
    silenced_exceptions=(RetryTaskError,),
    silo_mode=SiloMode.CELL,
)
def clear_expired_resolutions(release_id: int, *, after_id: int = 0) -> None:
    """
    This should be fired when ``release_id`` is created or its dates change, and will indicate to
    the system that any pending resolutions older than the given release can now
    be safely transitioned to resolved.

    This is currently only used for ``in_next_release`` resolution.
    """
    try:
        release = Release.objects.get(id=release_id)
    except Release.DoesNotExist:
        return

    if features.has("organizations:release-resolution-finalized-order", release.organization):
        context = ResolutionBatchContext()
        try:
            next_cursor = _clear_finalized_resolutions(release, after_id=after_id, context=context)
            if next_cursor is not None:
                # Publish after the batch commits. Wait for acknowledgement so
                # a delivery failure retries this page instead of losing the rest.
                context.phase = "publish"
                context.project_id = context.anchor_id = None
                future = clear_expired_resolutions.apply_async_with_future(
                    kwargs={"release_id": release.id, "after_id": next_cursor}
                )
                if future is not None:
                    future.result(timeout=3)
        except ProcessingDeadlineExceeded as exc:
            _report_batch_failure(exc, release, after_id, context)
            raise
        except Exception as exc:
            _report_batch_failure(exc, release, after_id, context)
            raise RetryTaskError() from exc
        return

    # A queued continuation must stop when the flag is disabled, rather than
    # falling through to the unbounded legacy operation.
    if after_id:
        return

    # The legacy path assigns the triggering release directly. The finalized
    # path can also reevaluate an archived anchor, so it filters successors instead.
    if release.status not in (ReleaseStatus.OPEN, None):
        return

    resolution_list = list(
        GroupResolution.objects.filter(
            Q(type=GroupResolution.Type.in_next_release) | Q(type__isnull=True),
            release__projects__in=[p.id for p in release.projects.all()],
            release__date_added__lt=release.date_added,
            status=GroupResolution.Status.pending,
        ).exclude(release=release)
    )

    if not resolution_list:
        return

    GroupResolution.objects.filter(id__in=[r.id for r in resolution_list]).update(
        release=release,
        type=GroupResolution.Type.in_release,
        status=GroupResolution.Status.resolved,
    )

    _update_resolution_activities(resolution_list, release)


def _clear_finalized_resolutions(
    release: Release, *, after_id: int = 0, context: ResolutionBatchContext | None = None
) -> int | None:
    if context is None:
        context = ResolutionBatchContext()
    release_order = release.date_released or release.date_added
    # A date edit can make this release a successor, or move an existing
    # resolution's anchor before a release that was already registered.
    pending = (
        GroupResolution.objects.filter(
            Q(type=GroupResolution.Type.in_next_release) | Q(type__isnull=True),
            status=GroupResolution.Status.pending,
            id__gt=after_id,
            group__project_id__in=release.projects.values("id"),
            release__organization_id=release.organization_id,
        )
        .alias(resolution_release_order=Coalesce("release__date_released", "release__date_added"))
        .filter(
            Q(release=release)
            | Q(resolution_release_order__lt=release_order)
            | Q(resolution_release_order=release_order, release_id__lt=release.id)
        )
        .select_related("release", "group__project")
        .order_by("id")
    )
    next_releases: dict[tuple[int, int], Release | None] = {}
    using = router.db_for_write(GroupResolution)
    started = monotonic()
    examined = completed = 0
    with statement_timeout(using, timedelta(seconds=1)):
        # Bound SQL execution and lock waits on the database itself, including
        # the candidate query. SET LOCAL cannot leak to another connection user.
        with connections[using].cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout = '500ms'")
        # Lock before choosing successors so concurrent tasks cannot overwrite
        # each other's assignments or a new manual resolution.
        resolutions = list(pending.select_for_update(of=("self",))[:RESOLUTION_BATCH_SIZE])
        for resolution in resolutions:
            # Finish the current resolution and commit progress before yielding.
            # Individual statements are bounded even when a database is busy.
            if examined and monotonic() - started >= RESOLUTION_BATCH_SECONDS:
                break
            project = resolution.group.project
            key = (project.id, resolution.release_id)
            if key not in next_releases:
                context.phase = "successor"
                context.project_id, context.anchor_id = key
                try:
                    next_releases[key] = Release.objects.get_next_release(
                        project, resolution.release, use_finalized_order=True
                    )
                except Release.DoesNotExist:
                    next_releases[key] = None
            next_release = next_releases[key]
            if next_release is not None:
                context.phase = "write"
                context.project_id = context.anchor_id = None
                GroupResolution.objects.filter(id=resolution.id).update(
                    release=next_release,
                    type=GroupResolution.Type.in_release,
                    status=GroupResolution.Status.resolved,
                )
                _update_resolution_activities([resolution], next_release)
                completed += 1
            after_id = resolution.id
            examined += 1

    metrics.timing("releases.resolution_batch.duration", monotonic() - started, sample_rate=1.0)
    metrics.distribution("releases.resolution_batch.examined", examined, sample_rate=1.0)
    metrics.distribution("releases.resolution_batch.completed", completed, sample_rate=1.0)
    metrics.distribution(
        "releases.resolution_batch.successor_lookups", len(next_releases), sample_rate=1.0
    )
    logger.info(
        "releases.resolution_batch.completed",
        extra={
            "release_id": release.id,
            "organization_id": release.organization_id,
            "after_id": after_id,
            "examined": examined,
            "completed": completed,
        },
    )
    # Advance over examined rows even when they have no successor. Replaying a
    # page after commit is safe: completed rows are excluded by the pending filter.
    if examined < len(resolutions) or len(resolutions) == RESOLUTION_BATCH_SIZE:
        return after_id
    return None


def _update_resolution_activities(resolutions: Sequence[GroupResolution], release: Release) -> None:
    for resolution in resolutions:
        try:
            activity = Activity.objects.filter(
                group=resolution.group_id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
                ident=resolution.id,
            ).order_by("-datetime")[0]
        except IndexError:
            continue

        # TODO: Do we need to write a `GroupHistory` row here?
        activity.update(data={**(activity.data or {}), "version": release.version})
