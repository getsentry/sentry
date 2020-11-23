from __future__ import absolute_import, print_function

from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.tasks.base import instrumented_task
from sentry.utils.committers import get_serialized_event_file_committers


@instrumented_task(
    name="sentry.tasks.process_suspect_commits", default_retry_delay=60 * 5, max_retries=5
)
def process_suspect_commits(event, **kwargs):
    # TODO(Chris F.) Check memcache to see if we have already processed this event hash.
    committers = get_serialized_event_file_committers(event.project, event)
    # TODO(Chris F.) Store committers in memcache with event hash as key.
    # create group owner reference for the found suspect commits
    for committer in committers:
        # GOTCHA: Some suspect commits can't be linked to sentry users and don't have an id.
        if "id" in committer["author"]:
            owner_id = committer["author"]["id"]
            GroupOwner.objects.get_or_create(
                group_id=event.group_id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                project=event.project,
                organization=event.project.organization,
                user_id=owner_id,
            )
        else:
            pass

    # TODO(Chris F.): Store/Cache suspect commit info so we don't recalculate it on issue details load?
    # There are issues with this...like mutable commits and commits coming in after events.
