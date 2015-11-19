from __future__ import absolute_import, print_function

from django.db import connection
from django.db.models import Q

from sentry.models import (
    Activity, Group, GroupResolution, GroupStatus, Project, Release
)
from sentry.tasks.base import instrumented_task


@instrumented_task(name='sentry.tasks.clear_expired_resolutions',
                   time_limit=15,
                   soft_time_limit=10)
def clear_expired_resolutions(release_id):
    """
    This should be fired when ``release_id`` is created, and will indicate to
    the system that any pending resolutions older than the given release can now
    be safely transitioned to resolved.
    """
    try:
        release = Release.objects.get_from_cache(
            id=release_id,
        )
    except Release.DoesNotExist:
        return

    project = Project.objects.get_from_cache(
        id=release.project_id,
    )

    resolution_list = GroupResolution.objects.filter(
        release__project=project,
        release__date_added__lt=release.date_added,
    ).exclude(
        release=release,
    )

    for resolution in resolution_list:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM sentry_groupresolution WHERE id = %s", [resolution.id])
        affected = cursor.rowcount > 0

        if not affected:
            continue

        Group.objects.filter(
            Q(active_at__lte=release.date_added) | Q(active_at__isnull=True),
            id=resolution.group_id,
            status=GroupStatus.UNRESOLVED,
        ).update(
            status=GroupStatus.RESOLVED,
        )

        if affected:
            activity = Activity.objects.filter(
                group=resolution.group_id,
                type=Activity.SET_RESOLVED_IN_RELEASE,
            ).order_by('-datetime')[0]

            activity.update(data={
                'version': release.version,
            })
