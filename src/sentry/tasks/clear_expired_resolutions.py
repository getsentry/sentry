import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from time import monotonic
from typing import NamedTuple

from django.db import OperationalError, connections, router
from django.db.models import BigIntegerField, Case, Q, Value, When
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
    resolution_ids: list[int] | None = None


class ResolutionCandidate(NamedTuple):
    id: int
    group_id: int
    project_id: int
    anchor_id: int
    anchor_date: datetime


@dataclass(frozen=True)
class ResolutionUpdate:
    resolution_id: int
    group_id: int
    release_id: int
    version: str


@dataclass(frozen=True)
class ResolutionBatch:
    next_cursor: int | None
    retry_ids: list[int]
    retry_error: str = "other"


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
    exc: BaseException,
    release: Release,
    after_id: int,
    context: ResolutionBatchContext,
    *,
    retrying: bool = True,
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
        "resolution_ids": context.resolution_ids,
    }
    if error != "other" or isinstance(exc, ProcessingDeadlineExceeded):
        logger.warning("releases.resolution_batch.failed", extra=extra)
    else:
        logger.exception("releases.resolution_batch.failed", extra=extra)
    if retrying:
        _report_exhaustion(release, after_id, context, error)


def _report_exhaustion(
    release: Release, after_id: int, context: ResolutionBatchContext, error: str = "other"
) -> None:
    task = current_task()
    if task is not None and not task.retries_remaining:
        metrics.incr(
            "releases.resolution_batch.exhausted",
            tags={"phase": context.phase, "error": error},
            sample_rate=1.0,
        )
        # Replay these arguments after fixing the cause. Failed-row retries are
        # isolated from pagination, so exhaustion does not strand later pages.
        logger.warning(
            "releases.resolution_batch.exhausted",
            extra={
                "release_id": release.id,
                "organization_id": release.organization_id,
                "after_id": after_id,
                "resolution_ids": context.resolution_ids,
                "phase": context.phase,
                "error": error,
            },
        )


@instrumented_task(
    name="sentry.tasks.clear_expired_resolutions",
    namespace=issues_tasks,
    processing_deadline_duration=15,
    retry=Retry(times=5, delay=30, on=(ProcessingDeadlineExceeded,)),
    silenced_exceptions=(RetryTaskError,),
    silo_mode=SiloMode.CELL,
)
def clear_expired_resolutions(
    release_id: int, *, after_id: int = 0, resolution_ids: list[int] | None = None
) -> None:
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
        context = ResolutionBatchContext(resolution_ids=resolution_ids)
        try:
            batch = _clear_finalized_resolutions(
                release, after_id=after_id, resolution_ids=resolution_ids, context=context
            )
            if resolution_ids is not None:
                if batch.retry_ids:
                    _report_exhaustion(release, after_id, context, batch.retry_error)
                    raise RetryTaskError()
                return

            # Retry only the failed rows, independently of forward pagination.
            # Publish retries first: if delivery fails, replaying this cursor
            # rediscovers the still-pending rows. Acknowledged duplicates are safe.
            context.phase = "publish"
            context.project_id = context.anchor_id = None
            if batch.retry_ids:
                _publish_resolution_work(release.id, resolution_ids=batch.retry_ids)
            if batch.next_cursor is not None:
                _publish_resolution_work(release.id, after_id=batch.next_cursor)
        except RetryTaskError:
            raise
        except ProcessingDeadlineExceeded as exc:
            _report_batch_failure(exc, release, after_id, context)
            raise
        except Exception as exc:
            _report_batch_failure(exc, release, after_id, context)
            raise RetryTaskError() from exc
        return

    # A queued continuation must stop when the flag is disabled, rather than
    # falling through to the unbounded legacy operation.
    if after_id or resolution_ids is not None:
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


def _publish_resolution_work(
    release_id: int, *, after_id: int = 0, resolution_ids: list[int] | None = None
) -> None:
    kwargs: dict[str, int | list[int]] = {"release_id": release_id, "after_id": after_id}
    if resolution_ids is not None:
        kwargs["resolution_ids"] = resolution_ids
    future = clear_expired_resolutions.apply_async_with_future(kwargs=kwargs)
    if future is not None:
        future.result(timeout=3)


def _clear_finalized_resolutions(
    release: Release,
    *,
    after_id: int = 0,
    resolution_ids: list[int] | None = None,
    context: ResolutionBatchContext | None = None,
) -> ResolutionBatch:
    if context is None:
        context = ResolutionBatchContext(resolution_ids=resolution_ids)
    using = router.db_for_write(GroupResolution)
    release_order = release.date_released or release.date_added
    pending = (
        GroupResolution.objects.using(using)
        .filter(
            Q(type=GroupResolution.Type.in_next_release) | Q(type__isnull=True),
            status=GroupResolution.Status.pending,
            group__project_id__in=release.projects.values("id"),
            release__organization_id=release.organization_id,
        )
        .annotate(
            resolution_release_order=Coalesce("release__date_released", "release__date_added")
        )
    )
    candidates = pending.filter(id__gt=after_id).filter(
        Q(release=release)
        | Q(resolution_release_order__lt=release_order)
        | Q(resolution_release_order=release_order, release_id__lt=release.id)
    )
    if resolution_ids is not None:
        assert len(resolution_ids) <= RESOLUTION_BATCH_SIZE
        candidates = candidates.filter(id__in=resolution_ids)
    fields = ("id", "group_id", "group__project_id", "release_id", "resolution_release_order")
    started = monotonic()
    with statement_timeout(using, timedelta(seconds=1)):
        resolutions = [
            ResolutionCandidate(*row)
            for row in candidates.order_by("id").values_list(*fields)[:RESOLUTION_BATCH_SIZE]
        ]

    next_releases: dict[tuple[int, int], tuple[int, str] | None] = {}
    failed_anchors: set[tuple[int, int]] = set()
    retry_ids: list[int] = []
    examined: dict[int, ResolutionCandidate] = {}
    for resolution in resolutions:
        if examined and monotonic() - started >= RESOLUTION_BATCH_SECONDS:
            break
        examined[resolution.id] = resolution
        after_id = resolution.id
        key = (resolution.project_id, resolution.anchor_id)
        if key not in next_releases and key not in failed_anchors:
            context.phase = "successor"
            context.project_id, context.anchor_id = key
            try:
                # This transaction holds no resolution row locks. Roll it back
                # before handling a timeout so other anchors can still progress.
                with statement_timeout(using, timedelta(seconds=1)):
                    next_releases[key] = (
                        Release.objects.get_next_release_queryset(
                            organization_id=release.organization_id,
                            project_id=resolution.project_id,
                            current_release_id=resolution.anchor_id,
                            current_date=resolution.anchor_date,
                            use_finalized_order=True,
                        )
                        .using(using)
                        .values_list("id", "version")
                        .first()
                    )
            except OperationalError as exc:
                if _database_error_kind(exc) != "statement_timeout":
                    raise
                _report_batch_failure(exc, release, after_id, context, retrying=False)
                failed_anchors.add(key)
        if key in failed_anchors:
            retry_ids.append(resolution.id)

    context.phase = "write"
    context.project_id = context.anchor_id = None
    updates: list[ResolutionUpdate] = []
    eligible_ids = examined.keys() - set(retry_ids)
    if eligible_ids:
        lock_started = monotonic()
        with statement_timeout(using, timedelta(seconds=1)):
            with connections[using].cursor() as cursor:
                cursor.execute("SET LOCAL lock_timeout = '500ms'")
            locked = list(
                pending.filter(id__in=eligible_ids)
                .order_by("id")
                .select_for_update(of=("self",))
                .values_list(*fields)
            )
            for row in locked:
                resolution = ResolutionCandidate(*row)
                # A concurrent resolve can reuse the row. Check its anchor and
                # effective date as well as status/type before using the lookup.
                # Release edits after this snapshot retain the existing race;
                # finalization also schedules reevaluation of pending resolutions.
                if resolution != examined[resolution.id]:
                    retry_ids.append(resolution.id)
                    continue
                successor = next_releases[(resolution.project_id, resolution.anchor_id)]
                if successor is not None:
                    updates.append(ResolutionUpdate(resolution.id, resolution.group_id, *successor))
            _complete_resolution_batch(updates)
        metrics.timing(
            "releases.resolution_batch.locked_duration", monotonic() - lock_started, sample_rate=1.0
        )

    metrics.timing("releases.resolution_batch.duration", monotonic() - started, sample_rate=1.0)
    metrics.distribution("releases.resolution_batch.examined", len(examined), sample_rate=1.0)
    metrics.distribution("releases.resolution_batch.completed", len(updates), sample_rate=1.0)
    metrics.distribution(
        "releases.resolution_batch.successor_lookups",
        len(next_releases) + len(failed_anchors),
        sample_rate=1.0,
    )
    logger.info(
        "releases.resolution_batch.completed",
        extra={
            "release_id": release.id,
            "organization_id": release.organization_id,
            "after_id": after_id,
            "examined": len(examined),
            "completed": len(updates),
            "retry_count": len(retry_ids),
        },
    )
    retry_error = "other"
    if failed_anchors:
        context.phase = "successor"
        context.project_id, context.anchor_id = next(iter(failed_anchors))
        retry_error = "statement_timeout"
    if resolution_ids is not None:
        # Keep unexamined retry rows within this activation's retry budget.
        retry_ids.extend(row.id for row in resolutions if row.id not in examined)
        return ResolutionBatch(None, retry_ids, retry_error)
    next_cursor = None
    if len(examined) < len(resolutions) or len(resolutions) == RESOLUTION_BATCH_SIZE:
        next_cursor = after_id
    return ResolutionBatch(next_cursor, retry_ids, retry_error)


def _complete_resolution_batch(updates: Sequence[ResolutionUpdate]) -> None:
    if not updates:
        return

    GroupResolution.objects.filter(id__in=[update.resolution_id for update in updates]).update(
        release_id=Case(
            *(When(id=update.resolution_id, then=Value(update.release_id)) for update in updates),
            output_field=BigIntegerField(),
        ),
        type=GroupResolution.Type.in_release,
        status=GroupResolution.Status.resolved,
    )

    activity_filter = Q()
    versions = {}
    for update in updates:
        activity_filter |= Q(group_id=update.group_id, ident=str(update.resolution_id))
        versions[(update.group_id, str(update.resolution_id))] = update.version

    # Fetch only the latest activity for each exact (issue, resolution) pair.
    # The ID tie-break makes duplicate timestamps deterministic.
    activities = list(
        Activity.objects.filter(activity_filter, type=ActivityType.SET_RESOLVED_IN_RELEASE.value)
        .order_by("group_id", "ident", "-datetime", "-id")
        .distinct("group_id", "ident")
    )
    for activity in activities:
        assert activity.ident is not None
        activity.data = {
            **(activity.data or {}),
            "version": versions[(activity.group_id, activity.ident)],
        }
    Activity.objects.bulk_update(activities, ["data"])


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
