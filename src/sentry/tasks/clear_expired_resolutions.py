from django.db.models import Q

from sentry import features
from sentry.models.activity import Activity
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks
from sentry.types.activity import ActivityType


def clear_next_release_resolutions(release):
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

    for resolution in resolution_list:
        try:
            activity = Activity.objects.filter(
                group=resolution.group_id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
                ident=resolution.id,
            ).order_by("-datetime")[0]
        except IndexError:
            continue

        # TODO: Do we need to write a `GroupHistory` row here?
        activity.update(data={"version": release.version})


def clear_future_release_resolutions(release):
    """
    Clear group resolutions of type `in_future_release` where:
    1. The organization has the "resolve-in-future-release" feature enabled
    2. The future_release_version matches the newly created release version
    3. The resolution is still pending
    """
    resolution_list = list(
        GroupResolution.objects.filter(
            type=GroupResolution.Type.in_future_release,
            future_release_version=release.version,
            status=GroupResolution.Status.pending,
        ).select_related("group__project__organization")
    )

    if not resolution_list:
        return

    # Filter resolutions based on feature flag
    filtered_resolutions = []
    for resolution in resolution_list:
        if features.has(
            "organizations:resolve-in-future-release", resolution.group.project.organization
        ):
            filtered_resolutions.append(resolution)

    if not filtered_resolutions:
        return

    GroupResolution.objects.filter(id__in=[r.id for r in filtered_resolutions]).update(
        release=release,
        type=GroupResolution.Type.in_release,
        status=GroupResolution.Status.resolved,
    )

    for resolution in filtered_resolutions:
        try:
            activity = Activity.objects.filter(
                group=resolution.group_id,
                type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
                ident=resolution.id,
            ).order_by("-datetime")[0]
        except IndexError:
            continue

        # TODO: Do we need to write a `GroupHistory` row here?
        activity.update(data={"version": release.version})


@instrumented_task(
    name="sentry.tasks.clear_expired_resolutions",
    time_limit=15,
    soft_time_limit=10,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        processing_deadline_duration=15,
    ),
)
def clear_expired_resolutions(release_id):
    """
    This should be fired when ``release_id`` is created, and will indicate to
    the system that any pending resolutions older than the given release can now
    be safely transitioned to resolved.

    This is currently only used for ``in_next_release`` and ``in_future_release`` resolutions.
    """
    try:
        release = Release.objects.get(id=release_id)
    except Release.DoesNotExist:
        return

    clear_next_release_resolutions(release)
    clear_future_release_resolutions(release)
