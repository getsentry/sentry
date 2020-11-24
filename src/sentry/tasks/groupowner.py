from __future__ import absolute_import, print_function

from django.core.cache import cache

from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.tasks.base import instrumented_task
from sentry.utils.committers import get_serialized_event_file_committers


PREFERRED_GROUP_OWNERS = 5
PREFERRED_GROUP_OWNER_AGE = timedelta(days=10)


@instrumented_task(
    name="sentry.tasks.process_suspect_commits", default_retry_delay=60 * 5, max_retries=5
)
def process_suspect_commits(event, **kwargs):
    cache_key = "workflow-owners:{}".format(event.hash)
    committers = cache.get(cache_key)
    if committers is None:
        owners = GroupOwner.objects.filter(
            group_id=event.group_id, project=event.project, organization=event.project.organization
        )
        owner_count = owners.count()
        if owner_count >= PREFERRED_GROUP_OWNERS:
            # We have some owners older than we'd prefer.
            can_delete = owners.filter(
                date_added__lte=timezone.now() - PREFERRED_GROUP_OWNER_AGE
            ).exists()
        else:
            can_delete = False

        if owner_count < PREFERRED_GROUP_OWNERS or can_delete:
            process_groupowner_from_suspect_committers(event, can_delete)


def process_groupowner_from_suspect_committers(event, can_delete):
    committers = get_serialized_event_file_committers(event.project, event)
    cache_key = "workflow-owners:{}".format(event.hash)
    cache.set(cache_key, committers, 3600)
    for committer in committers:
        if "id" in committer["author"]:
            owner_id = committer["author"]["id"]
            go, created = GroupOwner.objects.get_or_create(
                group_id=event.group_id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                user_id=owner_id,
                project=event.project,
                organization=event.project.organization,
            )
            if not created:
                go.update({"date_added": timezone.now()})
            elif created and can_delete:
                # delete the oldest GroupOwner
                GroupOwner.objects.filter(
                    group_id=event.group_id,
                    project=event.project,
                    organization=event.project.organization,
                ).order_by("-date_added").first().delete()
        else:
            # TODO(Chris F.) We actually need to store and display these too, somehow. In the future.
            pass

    # TODO(Chris F.) We would like to store this commit information so that we can get perf gains
    # and synced information on the Issue details page.
    # There are issues with this...like mutable commits and commits coming in after events.
