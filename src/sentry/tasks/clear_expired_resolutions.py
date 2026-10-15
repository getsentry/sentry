import logging
from collections.abc import Sequence
from dataclasses import dataclass
from time import monotonic

from django.db import connections, router, transaction
from django.db.models import BigIntegerField, Case, Q, Value, When
from django.db.models.functions import Coalesce
from taskbroker_client.retry import LastAction, Retry, RetryTaskError

from sentry import features
from sentry.models.activity import Activity
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release, ReleaseStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.types.activity import ActivityType
from sentry.utils import metrics

logger = logging.getLogger(__name__)

RESOLUTION_BATCH_SIZE = 100
RESOLUTION_BATCH_SECONDS = 3


@dataclass(frozen=True)
class ResolutionUpdate:
    resolution_id: int
    group_id: int
    release_id: int
    version: str


@instrumented_task(
    name="sentry.tasks.clear_expired_resolutions",
    namespace=issues_tasks,
    processing_deadline_duration=15,
    retry=Retry(times=5, delay=30, times_exceeded=LastAction.Deadletter),
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
        try:
            next_cursor = _clear_finalized_resolutions(release, after_id=after_id)
            if next_cursor is not None:
                # Publish after the batch commits. Wait for acknowledgement so
                # a delivery failure retries this page instead of losing the rest.
                future = clear_expired_resolutions.apply_async_with_future(
                    kwargs={"release_id": release.id, "after_id": next_cursor}
                )
                if future is not None:
                    future.result(timeout=3)
        except Exception as exc:
            metrics.incr("releases.resolution_batch.failed", sample_rate=1.0)
            logger.exception(
                "releases.resolution_batch.failed",
                extra={
                    "release_id": release.id,
                    "organization_id": release.organization_id,
                    "after_id": after_id,
                },
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


def _clear_finalized_resolutions(release: Release, *, after_id: int = 0) -> int | None:
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
        .annotate(
            resolution_release_order=Coalesce("release__date_released", "release__date_added")
        )
        .filter(
            Q(release=release)
            | Q(resolution_release_order__lt=release_order)
            | Q(resolution_release_order=release_order, release_id__lt=release.id)
        )
        .values_list(
            "id", "group_id", "group__project_id", "release_id", "resolution_release_order"
        )
        .order_by("id")
    )
    next_releases: dict[tuple[int, int], tuple[int, str] | None] = {}
    updates: list[ResolutionUpdate] = []
    using = router.db_for_write(GroupResolution)
    started = monotonic()
    examined = completed = 0
    with transaction.atomic(using=using):
        # Bound SQL execution and lock waits on the database itself, including
        # the candidate query. SET LOCAL cannot leak to another connection user.
        with connections[using].cursor() as cursor:
            cursor.execute("SET LOCAL statement_timeout = '1s'")
            cursor.execute("SET LOCAL lock_timeout = '500ms'")
        # Lock before choosing successors so concurrent tasks cannot overwrite
        # each other's assignments or a new manual resolution.
        resolutions = list(pending.select_for_update(of=("self",))[:RESOLUTION_BATCH_SIZE])
        for resolution_id, group_id, project_id, anchor_id, anchor_date in resolutions:
            # Reserve the remaining task time for the bounded bulk writes.
            if examined and monotonic() - started >= RESOLUTION_BATCH_SECONDS:
                break
            key = (project_id, anchor_id)
            if key not in next_releases:
                next_releases[key] = (
                    Release.objects.get_next_release_queryset(
                        organization_id=release.organization_id,
                        project_id=project_id,
                        current_release_id=anchor_id,
                        current_date=anchor_date,
                        use_finalized_order=True,
                    )
                    .values_list("id", "version")
                    .first()
                )
            next_release = next_releases[key]
            if next_release is not None:
                updates.append(
                    ResolutionUpdate(resolution_id, group_id, next_release[0], next_release[1])
                )
                completed += 1
            after_id = resolution_id
            examined += 1
        _complete_resolution_batch(updates)

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
    # The ID tie-break makes duplicate timestamps deterministic. An instance
    # update sends post_save, but Activity has no update-specific receivers or
    # model cache to maintain; these are metadata edits, not new activities.
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
