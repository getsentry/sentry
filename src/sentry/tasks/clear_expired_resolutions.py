from collections import defaultdict
from collections.abc import Sequence

from django.db import router, transaction
from django.db.models import Q
from django.db.models.functions import Coalesce

from sentry import features
from sentry.models.activity import Activity
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.types.activity import ActivityType


@instrumented_task(
    name="sentry.tasks.clear_expired_resolutions",
    namespace=issues_tasks,
    processing_deadline_duration=15,
    silo_mode=SiloMode.CELL,
)
def clear_expired_resolutions(release_id):
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
        _clear_finalized_resolutions(release)
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


def _clear_finalized_resolutions(release: Release) -> None:
    release_order = release.date_released or release.date_added
    # A date edit can make this release a successor, or move an existing
    # resolution's anchor before a release that was already registered.
    pending = (
        GroupResolution.objects.filter(
            Q(type=GroupResolution.Type.in_next_release) | Q(type__isnull=True),
            status=GroupResolution.Status.pending,
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
    resolutions_by_release: dict[Release, list[GroupResolution]] = defaultdict(list)
    with transaction.atomic(using=router.db_for_write(GroupResolution)):
        # Lock before choosing successors so concurrent tasks cannot overwrite
        # each other's assignments or a new manual resolution.
        for resolution in pending.select_for_update(of=("self",)):
            project = resolution.group.project
            key = (project.id, resolution.release_id)
            if key not in next_releases:
                try:
                    next_releases[key] = Release.objects.get_next_release(
                        project, resolution.release, use_finalized_order=True
                    )
                except Release.DoesNotExist:
                    next_releases[key] = None
            next_release = next_releases[key]
            if next_release is not None:
                resolutions_by_release[next_release].append(resolution)

        for next_release, resolutions in resolutions_by_release.items():
            GroupResolution.objects.filter(id__in=[r.id for r in resolutions]).update(
                release=next_release,
                type=GroupResolution.Type.in_release,
                status=GroupResolution.Status.resolved,
            )
            _update_resolution_activities(resolutions, next_release)


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
        activity.update(data={**activity.data, "version": release.version})
