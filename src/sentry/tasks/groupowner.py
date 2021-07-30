import logging
from datetime import timedelta

from django.utils import timezone

from sentry.models import Commit, Project, Release
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.committers import get_event_file_committers
from sentry.utils.sdk import set_current_event_project

PREFERRED_GROUP_OWNERS = 2
PREFERRED_GROUP_OWNER_AGE = timedelta(days=7)
MIN_COMMIT_SCORE = 2

logger = logging.getLogger("tasks.groupowner")


@instrumented_task(
    name="sentry.tasks.process_suspect_commits",
    queue="group_owners.process_suspect_commits",
    default_retry_delay=5,
    max_retries=5,
)
def process_suspect_commits(event_id, event_platform, event_frames, group_id, project_id, **kwargs):
    metrics.incr("sentry.tasks.process_suspect_commits.start")
    set_current_event_project(project_id)

    project = Project.objects.get_from_cache(id=project_id)
    owners = GroupOwner.objects.filter(
        group_id=group_id,
        project=project,
        organization_id=project.organization_id,
        type=GroupOwnerType.SUSPECT_COMMIT.value,
    )
    owner_count = owners.count()
    if owner_count >= PREFERRED_GROUP_OWNERS:
        owners = owners.filter(date_added__lte=timezone.now() - PREFERRED_GROUP_OWNER_AGE).order_by(
            "-date_added"
        )
        if not owners.exists():
            metrics.incr(
                "sentry.tasks.process_suspect_commits.aborted",
                tags={"detail": "maxed_owners_none_old"},
            )
            return

    with metrics.timer("sentry.tasks.process_suspect_commits.process_loop"):
        try:
            with metrics.timer(
                "sentry.tasks.process_suspect_commits.get_serialized_event_file_committers"
            ):
                committers = get_event_file_committers(
                    project, group_id, event_frames, event_platform
                )
            owner_scores = {}
            for committer in committers:
                if "id" in committer["author"]:
                    author_id = committer["author"]["id"]
                    for commit, score in committer["commits"]:
                        if score >= MIN_COMMIT_SCORE:
                            owner_scores[author_id] = max(score, owner_scores.get(author_id, 0))

            if owner_scores:
                for owner_id in sorted(owner_scores, reverse=True, key=owner_scores.get)[
                    :PREFERRED_GROUP_OWNERS
                ]:
                    go, created = GroupOwner.objects.update_or_create(
                        group_id=group_id,
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
                            try:
                                owner = owners[0]
                            except IndexError:
                                pass
                            else:
                                owner.delete()

        except Commit.DoesNotExist:
            logger.info(
                "process_suspect_commits.skipped",
                extra={"event": event_id, "reason": "no_commit"},
            )
        except Release.DoesNotExist:
            logger.info(
                "process_suspect_commits.skipped",
                extra={"event": event_id, "reason": "no_release"},
            )
