from django.db import transaction

from sentry import eventstream
from sentry.reprocessing2 import buffered_delete_old_primary_hash
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.reprocessing2.finish_reprocessing",
    queue="events.reprocessing.process_event",
    time_limit=(60 * 5) + 5,
    soft_time_limit=60 * 5,
)
def finish_reprocessing(project_id, group_id):
    from sentry.models import Activity, Group, GroupRedirect

    with transaction.atomic():
        group = Group.objects.get(id=group_id)

        # While we migrated all associated models at the beginning of
        # reprocessing, there is still the "reprocessing" activity that we need
        # to transfer manually.
        activity = Activity.objects.get(group_id=group_id)
        new_group_id = activity.group_id = activity.data["newGroupId"]
        activity.save()

        new_group = Group.objects.get(id=new_group_id)

        # Any sort of success message will be shown at the *new* group ID's URL
        GroupRedirect.objects.create(
            organization_id=new_group.project.organization_id,
            group_id=new_group_id,
            previous_group_id=group_id,
        )

        # All the associated models (groupassignee and eventattachments) should
        # have moved to a successor group that may be deleted independently.
        group.delete()

    # Tombstone unwanted events that should be dropped after new group
    # is generated after reprocessing
    buffered_delete_old_primary_hash(
        project_id=project_id,
        group_id=group_id,
        force_flush_batch=True,
    )

    eventstream.exclude_groups(project_id, [group_id])

    from sentry import similarity

    similarity.delete(None, group)
