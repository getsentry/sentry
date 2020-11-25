from __future__ import absolute_import, print_function

import logging

from datetime import timedelta

from django.utils import timezone

from sentry.eventstore.models import Event
from sentry.eventstore.processing import event_processing_store
from sentry.models import Project
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.tasks.base import instrumented_task
from sentry.utils.committers import get_serialized_event_file_committers

PREFERRED_GROUP_OWNERS = 3
PREFERRED_GROUP_OWNER_AGE = timedelta(days=1)

logger = logging.getLogger("tasks.groupowner")


@instrumented_task(
    name="sentry.tasks.process_suspect_commits", default_retry_delay=5, max_retries=5
)
def process_suspect_commits(group_id, cache_key, **kwargs):
    if group_id:
        can_process = True

        data = event_processing_store.get(cache_key)
        if not data:
            logger.info(
                "process_suspect_commits.skipped",
                extra={"cache_key": cache_key, "reason": "missing_cache"},
            )
            return

        event = Event(
            project_id=data["project"], event_id=data["event_id"], group_id=group_id, data=data
        )

        project = Project.objects.get_from_cache(id=event.project_id)
        owners = GroupOwner.objects.filter(
            group_id=event.group_id, project=project, organization_id=project.organization_id
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
            committers = get_serialized_event_file_committers(project, event)
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
                        project=project,
                        organization_id=project.organization_id,
                        defaults={
                            "date_added": timezone.now()
                        },  # Updates date of an existing owner, since we just matched them with this new event,
                    )
                    if created and oldest_owner is not None:
                        oldest_owner.delete()
                else:
                    # TODO(Chris F.) We actually need to store and display these too, somehow. In the future.
                    pass

    event_processing_store.delete_by_key(cache_key)
