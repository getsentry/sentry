from __future__ import absolute_import, print_function

import logging

from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from sentry.models import Project, Release
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.utils import metrics
from sentry.utils.committers import get_event_file_committers

PREFERRED_GROUP_OWNERS = 2
OWNER_CACHE_LIFE = 3600  # seconds
PREFERRED_GROUP_OWNER_AGE = timedelta(days=1)
GROUP_PROCESSING_DELAY = timedelta(
    minutes=60
)  # Minimum time between processing the same group id again
MIN_COMMIT_SCORE = 2

logger = logging.getLogger("tasks.groupowner")


def process_suspect_commits(event, **kwargs):
    metrics.incr("sentry.tasks.process_suspect_commits.start")
    with metrics.timer("sentry.tasks.process_suspect_commits"):
        can_process = True
        cache_key = "workflow-owners-ingestion:group-{}".format(event.group_id)
        owner_data = cache.get(cache_key)

        if owner_data and owner_data["count"] >= PREFERRED_GROUP_OWNERS:
            # Only process once per OWNER_CACHE_LIFE seconds for groups already populated with owenrs.
            metrics.incr(
                "sentry.tasks.process_suspect_commits.skipped", tags={"detail": "too_many_owners"}
            )
            can_process = False
        elif owner_data and owner_data["time"] > timezone.now() - GROUP_PROCESSING_DELAY:
            # Smaller delay for groups without PREFERRED_GROUP_OWNERS owners yet
            metrics.incr(
                "sentry.tasks.process_suspect_commits.skipped", tags={"detail": "group_delay"}
            )
            can_process = False
        else:
            project = Project.objects.get_from_cache(id=event.project_id)
            owners = GroupOwner.objects.filter(
                group_id=event.group_id,
                project=project,
                organization_id=project.organization_id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
            )
            owner_count = owners.count()
            if owner_count >= PREFERRED_GROUP_OWNERS:
                # We have enough owners already - so see if any are old.
                # If so, we can delete it and replace with a fresh one.
                owners = owners.filter(
                    date_added__lte=timezone.now() - PREFERRED_GROUP_OWNER_AGE
                ).order_by("-date_added")
                if not owners.exists():
                    metrics.incr(
                        "sentry.tasks.process_suspect_commits.aborted",
                        tags={"detail": "maxed_owners_none_old"},
                    )
                    can_process = False

            owner_data = {"count": owner_count, "time": timezone.now()}
            cache.set(cache_key, owner_data, OWNER_CACHE_LIFE)

        if can_process:
            with metrics.timer("sentry.tasks.process_suspect_commits.process_loop"):
                metrics.incr("sentry.tasks.process_suspect_commits.calculated")
                try:

                    with metrics.timer(
                        "sentry.tasks.process_suspect_commits.get_serialized_event_file_committers"
                    ):
                        committers = get_event_file_committers(project, event)
                    new_owners = []
                    for committer in committers:
                        if "id" in committer["author"]:
                            author_id = committer["author"]["id"]
                            for commit, score in committer["commits"]:
                                if score >= MIN_COMMIT_SCORE and not [
                                    aid for aid, score in new_owners if aid == author_id
                                ]:
                                    new_owners.append((author_id, score))

                    if new_owners:
                        for owner_id, score in sorted(new_owners, key=lambda a: a[1], reverse=True)[
                            :PREFERRED_GROUP_OWNERS
                        ]:
                            go, created = GroupOwner.objects.update_or_create(
                                group_id=event.group_id,
                                type=GroupOwnerType.SUSPECT_COMMIT.value,
                                user_id=owner_id,
                                project=project,
                                organization_id=project.organization_id,
                                defaults={
                                    "date_added": timezone.now()
                                },  # Updates date of an existing owner, since we just matched them with this new event
                            )
                            if created:
                                owner_count += 1
                                if owner_count > PREFERRED_GROUP_OWNERS:
                                    owners.first().delete()
                except Release.DoesNotExist:
                    logger.info(
                        "process_suspect_commits.skipped",
                        extra={"event": event.id, "reason": "no_release"},
                    )
