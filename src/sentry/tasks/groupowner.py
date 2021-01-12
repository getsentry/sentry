from __future__ import absolute_import, print_function

import logging

from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from sentry.models import Commit, Project, Release
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.utils import metrics
from sentry.utils.committers import get_event_file_committers

PREFERRED_GROUP_OWNERS = 2
OWNER_CACHE_LIFE = 604800  # 1 week in seconds
PREFERRED_GROUP_OWNER_AGE = timedelta(days=7)
MIN_COMMIT_SCORE = 2

logger = logging.getLogger("tasks.groupowner")


def process_suspect_commits(event, **kwargs):
    metrics.incr("sentry.tasks.process_suspect_commits.start")
    with metrics.timer("sentry.tasks.process_suspect_commits"):
        can_process = True
        # Abbreviation for "workflow-owners-ingestion:group-{}"
        cache_key = "w-o-i:g-{}".format(event.group_id)

        if cache.get(cache_key):
            # Only process once per OWNER_CACHE_LIFE seconds.
            metrics.incr(
                "sentry.tasks.process_suspect_commits.skipped", tags={"detail": "too_many_owners"}
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
                owners = owners.filter(
                    date_added__lte=timezone.now() - PREFERRED_GROUP_OWNER_AGE
                ).order_by("-date_added")
                if not owners.exists():
                    metrics.incr(
                        "sentry.tasks.process_suspect_commits.aborted",
                        tags={"detail": "maxed_owners_none_old"},
                    )
                    can_process = False

            cache.set(cache_key, True, OWNER_CACHE_LIFE)

        if can_process:
            with metrics.timer("sentry.tasks.process_suspect_commits.process_loop"):
                metrics.incr("sentry.tasks.process_suspect_commits.calculated")
                try:
                    with metrics.timer(
                        "sentry.tasks.process_suspect_commits.get_serialized_event_file_committers"
                    ):
                        committers = get_event_file_committers(project, event)
                    owner_scores = {}
                    for committer in committers:
                        if "id" in committer["author"]:
                            author_id = committer["author"]["id"]
                            for commit, score in committer["commits"]:
                                if score >= MIN_COMMIT_SCORE:
                                    owner_scores[author_id] = max(
                                        score, owner_scores.get(author_id, 0)
                                    )

                    if owner_scores:
                        for owner_id in sorted(owner_scores, reverse=True, key=owner_scores.get)[
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
                except Commit.DoesNotExist:
                    logger.info(
                        "process_suspect_commits.skipped",
                        extra={"event": event.event_id, "reason": "no_commit"},
                    )
                except Release.DoesNotExist:
                    logger.info(
                        "process_suspect_commits.skipped",
                        extra={"event": event.event_id, "reason": "no_release"},
                    )
