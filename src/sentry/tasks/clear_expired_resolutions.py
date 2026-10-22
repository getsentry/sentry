import logging
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from time import monotonic
from typing import Any, NamedTuple

from django.db import OperationalError, connections, router
from django.db.models import BigIntegerField, Case, Q, QuerySet, Value, When
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
RESOLUTION_BATCH_SECONDS = 2


class ResolutionCandidate(NamedTuple):
    id: int
    group_id: int
    project_id: int
    anchor_id: int
    anchor_date: datetime


class ResolutionUpdate(NamedTuple):
    group_id: int
    release_id: int
    version: str


def _timeout_kind(exc: OperationalError) -> str | None:
    cause = exc.__cause__
    if isinstance(cause, PostgresError):
        message = cause.diag.message_primary or ""
        if cause.pgcode == "57014" and "statement timeout" in message:
            return "statement_timeout"
        if cause.pgcode == "55P03" and "lock timeout" in message:
            return "lock_timeout"
    return None


@instrumented_task(
    name="sentry.tasks.clear_expired_resolutions",
    namespace=issues_tasks,
    processing_deadline_duration=15,
    retry=Retry(times=3, delay=30, on=(ProcessingDeadlineExceeded, OperationalError)),
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
        next_cursor = _clear_finalized_resolutions(release, after_id)
        if next_cursor is not None:
            try:
                future = clear_expired_resolutions.apply_async_with_future(
                    kwargs={"release_id": release.id, "after_id": next_cursor}
                )
                if future is not None:
                    future.result(timeout=3)
            except Exception as exc:
                # This page is committed, so retrying it only rereads rows still pending.
                logger.warning(
                    "releases.resolution_batch.publish_failed",
                    extra={
                        "release_id": release.id,
                        "organization_id": release.organization_id,
                        "after_id": after_id,
                        "next_cursor": next_cursor,
                    },
                    exc_info=True,
                )
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


def _clear_finalized_resolutions(release: Release, after_id: int = 0) -> int | None:
    """
    Resolve one page of pending resolutions and return the cursor for the next page.

    Successor lookups run before any resolution row is locked, and every statement is
    bounded server-side because the task deadline cannot interrupt a running query.
    Rows this page cannot finish are retried with the page; on the last attempt they
    are left pending and reported so that later pages still run.
    """
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
        .annotate(anchor_date=Coalesce("release__date_released", "release__date_added"))
        .values_list("id", "group_id", "group__project_id", "release_id", "anchor_date")
    )
    started = monotonic()
    with statement_timeout(using, timedelta(seconds=1)):
        candidates = [
            ResolutionCandidate(*row)
            for row in pending.filter(
                Q(release=release)
                | Q(anchor_date__lt=release_order)
                | Q(anchor_date=release_order, release_id__lt=release.id),
                id__gt=after_id,
            ).order_by("id")[:RESOLUTION_BATCH_SIZE]
        ]
    if not candidates:
        return None

    successors: dict[tuple[int, int], tuple[int, str] | None] = {}
    timed_out: set[tuple[int, int]] = set()
    examined: dict[int, ResolutionCandidate] = {}
    for candidate in candidates:
        if examined and monotonic() - started >= RESOLUTION_BATCH_SECONDS:
            break
        examined[candidate.id] = candidate
        key = (candidate.project_id, candidate.anchor_id)
        if key in successors or key in timed_out:
            continue
        try:
            with statement_timeout(using, timedelta(seconds=1)):
                successors[key] = (
                    Release.objects.get_next_release_queryset(
                        organization_id=release.organization_id,
                        project_id=candidate.project_id,
                        current_release_id=candidate.anchor_id,
                        current_date=candidate.anchor_date,
                        use_finalized_order=True,
                    )
                    .using(using)
                    .values_list("id", "version")
                    .first()
                )
        except OperationalError as exc:
            if _timeout_kind(exc) != "statement_timeout":
                raise
            timed_out.add(key)

    unfinished: dict[str, list[int]] = {}
    resolvable: dict[int, tuple[int, str]] = {}
    for candidate in examined.values():
        key = (candidate.project_id, candidate.anchor_id)
        if key in timed_out:
            unfinished.setdefault("successor_timeout", []).append(candidate.id)
        elif (successor := successors[key]) is not None:
            resolvable[candidate.id] = successor

    completed = 0
    if resolvable:
        try:
            completed, changed = _resolve_unchanged(using, pending, examined, resolvable)
            if changed:
                unfinished["changed"] = changed
        except OperationalError as exc:
            kind = _timeout_kind(exc)
            if kind is None:
                raise
            unfinished[f"write_{kind}"] = list(resolvable)

    metrics.timing("releases.resolution_batch.duration", monotonic() - started, sample_rate=1.0)
    metrics.distribution("releases.resolution_batch.completed", completed, sample_rate=1.0)
    if unfinished:
        task = current_task()
        retrying = task is not None and task.retries_remaining
        for reason, resolution_ids in unfinished.items():
            metrics.incr(
                "releases.resolution_batch.unfinished",
                amount=len(resolution_ids),
                tags={"reason": reason, "outcome": "retry" if retrying else "exhausted"},
                sample_rate=1.0,
            )
        # Replaying these arguments reevaluates any rows still pending.
        logger.warning(
            "releases.resolution_batch.unfinished",
            extra={
                "release_id": release.id,
                "organization_id": release.organization_id,
                "after_id": after_id,
                "unfinished": unfinished,
                "retrying": retrying,
            },
        )
        if retrying:
            raise RetryTaskError()

    if len(examined) < len(candidates) or len(candidates) == RESOLUTION_BATCH_SIZE:
        return next(reversed(examined))
    return None


def _resolve_unchanged(
    using: str,
    pending: QuerySet[GroupResolution, Any],
    examined: Mapping[int, ResolutionCandidate],
    successors: Mapping[int, tuple[int, str]],
) -> tuple[int, list[int]]:
    """Resolve rows still matching what the lookups examined; return the count and changed IDs."""
    changed: list[int] = []
    updates: dict[int, ResolutionUpdate] = {}
    with statement_timeout(using, timedelta(seconds=1)):
        with connections[using].cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout = '500ms'")
        locked = (
            pending.filter(id__in=list(successors)).order_by("id").select_for_update(of=("self",))
        )
        for row in locked:
            current = ResolutionCandidate(*row)
            # A concurrent resolve can reuse the row, or the anchor's dates can change.
            if current != examined[current.id]:
                changed.append(current.id)
            else:
                updates[current.id] = ResolutionUpdate(current.group_id, *successors[current.id])

        if updates:
            GroupResolution.objects.using(using).filter(id__in=list(updates)).update(
                release_id=Case(
                    *(
                        When(id=resolution_id, then=Value(update.release_id))
                        for resolution_id, update in updates.items()
                    ),
                    output_field=BigIntegerField(),
                ),
                type=GroupResolution.Type.in_release,
                status=GroupResolution.Status.resolved,
            )
            _update_latest_activities(using, updates)
    return len(updates), changed


def _update_latest_activities(using: str, updates: Mapping[int, ResolutionUpdate]) -> None:
    activity_filter = Q()
    versions = {}
    for resolution_id, update in updates.items():
        activity_filter |= Q(group_id=update.group_id, ident=str(resolution_id))
        versions[(update.group_id, str(resolution_id))] = update.version

    # The ID tie-break makes duplicate timestamps deterministic.
    activities = list(
        Activity.objects.using(using)
        .filter(activity_filter, type=ActivityType.SET_RESOLVED_IN_RELEASE.value)
        .order_by("group_id", "ident", "-datetime", "-id")
        .distinct("group_id", "ident")
    )
    for activity in activities:
        assert activity.ident is not None
        activity.data = {
            **(activity.data or {}),
            "version": versions[(activity.group_id, activity.ident)],
        }
    Activity.objects.using(using).bulk_update(activities, ["data"])


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
