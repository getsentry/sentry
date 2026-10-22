import logging
from collections import defaultdict
from collections.abc import Sequence
from datetime import timedelta
from time import monotonic

from django.db import OperationalError, connections, router
from django.db.models import Q, QuerySet
from django.db.models.functions import Coalesce
from psycopg2.errors import LockNotAvailable, QueryCanceled
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
        _clear_finalized_resolutions(release, after_id)
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


def _clear_finalized_resolutions(release: Release, after_id: int) -> None:
    # The task deadline cannot interrupt a running query, so every query is bounded
    # server-side, and no resolution row is locked while successors are looked up.
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
        .alias(anchor_order=Coalesce("release__date_released", "release__date_added"))
    )
    with statement_timeout(using, timedelta(seconds=1)):
        page = list(
            pending.filter(
                Q(release=release)
                | Q(anchor_order__lt=release_order)
                | Q(anchor_order=release_order, release_id__lt=release.id),
                id__gt=after_id,
            )
            .select_related("release", "group__project")
            .order_by("id")[:RESOLUTION_BATCH_SIZE]
        )
    if not page:
        return

    started = monotonic()
    successors: dict[tuple[int, int], Release | None] = {}
    timed_out: set[tuple[int, int]] = set()
    examined: list[GroupResolution] = []
    for resolution in page:
        if examined and monotonic() - started >= RESOLUTION_BATCH_SECONDS:
            break
        examined.append(resolution)
        key = (resolution.group.project_id, resolution.release_id)
        if key in successors or key in timed_out:
            continue
        try:
            with statement_timeout(router.db_for_read(Release), timedelta(seconds=1)):
                successors[key] = Release.objects.get_next_release(
                    resolution.group.project, resolution.release, use_finalized_order=True
                )
        except Release.DoesNotExist:
            successors[key] = None
        except OperationalError as exc:
            if not isinstance(exc.__cause__, QueryCanceled):
                raise
            metrics.incr("releases.resolution_batch.successor_timeout", sample_rate=1.0)
            timed_out.add(key)

    unfinished: list[int] = []
    by_successor: dict[Release, list[GroupResolution]] = defaultdict(list)
    for candidate in examined:
        key = (candidate.group.project_id, candidate.release_id)
        if key in timed_out:
            unfinished.append(candidate.id)
        elif (successor := successors[key]) is not None:
            by_successor[successor].append(candidate)

    if by_successor:
        try:
            unfinished.extend(_resolve_unchanged(using, pending, by_successor))
        except OperationalError as exc:
            if not isinstance(exc.__cause__, (QueryCanceled, LockNotAvailable)):
                raise
            unfinished.extend(r.id for resolutions in by_successor.values() for r in resolutions)

    if unfinished:
        task = current_task()
        retrying = task is not None and task.retries_remaining
        # Retrying rereads this page; rows resolved above drop out of it. On the last
        # attempt, leave these rows pending so later pages still run. Replaying these
        # arguments reevaluates them.
        logger.warning(
            "releases.resolution_batch.unfinished",
            extra={
                "release_id": release.id,
                "organization_id": release.organization_id,
                "after_id": after_id,
                "resolution_ids": sorted(unfinished),
                "retrying": retrying,
            },
        )
        if retrying:
            raise RetryTaskError()

    if len(examined) < len(page) or len(page) == RESOLUTION_BATCH_SIZE:
        clear_expired_resolutions.delay(release_id=release.id, after_id=examined[-1].id)


def _resolve_unchanged(
    using: str,
    pending: QuerySet[GroupResolution],
    by_successor: dict[Release, list[GroupResolution]],
) -> list[int]:
    """Resolve rows that still match what the lookups examined; return the IDs that changed."""
    examined = {r.id: r for resolutions in by_successor.values() for r in resolutions}
    with statement_timeout(using, timedelta(seconds=1)):
        with connections[using].cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout = '500ms'")
        # A concurrent resolve can reuse the row, or the anchor's dates can change.
        current = {
            row[0]: row[1:]
            for row in pending.filter(id__in=list(examined))
            .select_for_update(of=("self",))
            .order_by("id")
            .values_list("id", "release_id", "release__date_added", "release__date_released")
        }
        changed = [
            r.id
            for r in examined.values()
            if r.id in current
            and current[r.id] != (r.release_id, r.release.date_added, r.release.date_released)
        ]
        resolved: list[tuple[GroupResolution, str]] = []
        for successor, resolutions in by_successor.items():
            unchanged = [r.id for r in resolutions if r.id in current and r.id not in changed]
            if not unchanged:
                continue
            GroupResolution.objects.filter(id__in=unchanged).update(
                release=successor,
                type=GroupResolution.Type.in_release,
                status=GroupResolution.Status.resolved,
            )
            resolved.extend(
                (examined[resolution_id], successor.version) for resolution_id in unchanged
            )
        if resolved:
            _update_latest_activities(resolved)
    return changed


def _update_latest_activities(resolved: Sequence[tuple[GroupResolution, str]]) -> None:
    versions = {(r.group_id, str(r.id)): version for r, version in resolved}
    activity_filter = Q()
    for group_id, ident in versions:
        activity_filter |= Q(group_id=group_id, ident=ident)
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
