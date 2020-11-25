from __future__ import absolute_import, print_function

from datetime import timedelta

from django.utils import timezone

from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.tasks.base import instrumented_task
from sentry.utils.committers import get_serialized_event_file_committers


PREFERRED_GROUP_OWNERS = 3
PREFERRED_GROUP_OWNER_AGE = timedelta(days=1)


@instrumented_task(
    name="sentry.tasks.process_suspect_commits", default_retry_delay=60 * 5, max_retries=5
)
def process_suspect_commits(event, **kwargs):
    can_process = True

    owners = GroupOwner.objects.filter(
        group_id=event.group_id, project=event.project, organization=event.project.organization
    )
    owner_count = owners.count()
    oldest_owner = None

    if owner_count >= PREFERRED_GROUP_OWNERS:
        # We have enough owners already - so see if any are old.
        # If so, we can delete it and replace with a fresh one.
        oldest_owner = (
            owners.filter(date_added__lte=timezone.now() - PREFERRED_GROUP_OWNER_AGE)
            .order_by("-date_added")
            .first()
        )
        if not oldest_owner:
            can_process = False

    if can_process:
        committers = get_serialized_event_file_committers(event.project, event)
        # TODO(Chris F.) We would like to store this commit information so that we can get perf gains
        # and synced information on the Issue details page.
        # There are issues with this...like mutable commits and commits coming in after events.
        for committer in committers:
            if "id" in committer["author"]:
                owner_id = committer["author"]["id"]
                go, created = GroupOwner.objects.update_or_create(
                    group_id=event.group_id,
                    type=GroupOwnerType.SUSPECT_COMMIT.value,
                    user_id=owner_id,
                    project=event.project,
                    organization=event.project.organization,
                    defaults={
                        "date_added": timezone.now()
                    },  # Updates date of an existing owner, since we just matched them with this new event,
                )
                if created and oldest_owner is not None:
                    oldest_owner.delete()
            else:
                # TODO(Chris F.) We actually need to store and display these too, somehow. In the future.
                pass
