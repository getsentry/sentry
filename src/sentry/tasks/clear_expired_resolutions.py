from django.db.models import Q

from sentry.models import Activity, GroupResolution, Release
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.clear_expired_resolutions", time_limit=15, soft_time_limit=10)
def clear_expired_resolutions(release_id):
    """
    This should be fired when ``release_id`` is created, and will indicate to
    the system that any pending resolutions older than the given release can now
    be safely transitioned to resolved.

    This is currently only used for ``in_next_release`` resolutions.
    """
    try:
        release = Release.objects.get(id=release_id)
    except Release.DoesNotExist:
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

    for resolution in resolution_list:
        try:
            activity = Activity.objects.filter(
                group=resolution.group_id,
                type=Activity.SET_RESOLVED_IN_RELEASE,
                ident=resolution.id,
            ).order_by("-datetime")[0]
        except IndexError:
            continue

        activity.update(data={"version": release.version})
