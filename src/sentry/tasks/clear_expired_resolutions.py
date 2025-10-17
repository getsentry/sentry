import orjson
from django.db.models import Q
from sentry_relay.processing import compare_version as compare_version_relay
from sentry_relay.processing import parse_release

from sentry import features
from sentry.models.activity import Activity
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
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
    1. The organization the release belongs to has the "resolve-in-future-release" feature flag enabled
    2. The future_release_version is <= the newly created release version (using semver comparison)
    3. The resolution is still pending
    4. The resolution belongs to the same organization as the release
    """
    if not features.has(
        "organizations:resolve-in-future-release", release.organization
    ) or not Release.is_semver_version(release.version):
        return

    release_parsed = parse_release(release.version, json_loads=orjson.loads).get("version_raw")

    resolution_candidates = GroupResolution.objects.filter(
        type=GroupResolution.Type.in_future_release,
        status=GroupResolution.Status.pending,
        group__project__organization=release.organization,
        future_release_version__isnull=False,
    )

    resolution_list = []
    for resolution in resolution_candidates:
        if not Release.is_semver_version(resolution.future_release_version):
            continue

        # If release.version >= future_release_version, clear the resolution
        try:
            future_parsed = parse_release(
                resolution.future_release_version, json_loads=orjson.loads
            ).get("version_raw")

            if compare_version_relay(release_parsed, future_parsed) >= 0:
                resolution_list.append(resolution)
        except Exception:
            continue

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


@instrumented_task(
    name="sentry.tasks.clear_expired_resolutions",
    namespace=issues_tasks,
    processing_deadline_duration=15,
    silo_mode=SiloMode.REGION,
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
