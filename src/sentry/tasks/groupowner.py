import logging
from datetime import timedelta
from typing import cast

from django.utils import timezone

from sentry import analytics
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.committers import get_event_file_committers
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.sdk import set_current_event_project

PREFERRED_GROUP_OWNERS = 2
PREFERRED_GROUP_OWNER_AGE = timedelta(days=7)
MIN_COMMIT_SCORE = 2
DEBOUNCE_CACHE_KEY = lambda group_id: f"process-suspect-commits-{group_id}"

logger = logging.getLogger(__name__)


def _process_suspect_commits(
    event_id, event_platform, event_frames, group_id, project_id, sdk_name=None, **kwargs
):
    metrics.incr("sentry.tasks.process_suspect_commits.start")
    set_current_event_project(project_id)

    cache_key = DEBOUNCE_CACHE_KEY(group_id)

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
                    project, group_id, event_frames, event_platform, sdk_name=sdk_name
                )
            owner_scores: dict[str, int] = {}
            for committer in committers:
                author = cast(UserSerializerResponse, committer["author"])
                if author and "id" in author:
                    author_id = author["id"]
                    for _, score in committer["commits"]:
                        if score >= MIN_COMMIT_SCORE:
                            owner_scores[author_id] = max(score, owner_scores.get(author_id, 0))

            if owner_scores:
                for owner_id, _ in sorted(
                    sorted(owner_scores.items(), reverse=True, key=lambda item: item[1])
                )[:PREFERRED_GROUP_OWNERS]:
                    try:
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
                                    logger.info(
                                        "process_suspect_commits.group_owner_removed",
                                        extra={
                                            "event": event_id,
                                            "group": group_id,
                                            "owner_id": owner.user_id,
                                            "project": project_id,
                                        },
                                    )
                            analytics.record(
                                "groupowner.assignment",
                                organization_id=project.organization_id,
                                project_id=project.id,
                                group_id=group_id,
                                new_assignment=created,
                                user_id=go.user_id,
                                group_owner_type=go.type,
                                method="release_commit",
                            )

                    except GroupOwner.MultipleObjectsReturned:
                        GroupOwner.objects.filter(
                            group_id=group_id,
                            type=GroupOwnerType.SUSPECT_COMMIT.value,
                            user_id=owner_id,
                            project=project,
                            organization_id=project.organization_id,
                        )[0].delete()
                        logger.info(
                            "process_suspect_commits.multiple_owners_removed",
                            extra={
                                "event": event_id,
                                "group": group_id,
                                "owner_id": owner_id,
                                "project": project_id,
                            },
                        )

                cache.set(
                    cache_key, True, PREFERRED_GROUP_OWNER_AGE.total_seconds()
                )  # 1 week in seconds
        except Commit.DoesNotExist:
            cache.set(cache_key, True, timedelta(days=1).total_seconds())
            logger.info(
                "process_suspect_commits.skipped",
                extra={"event": event_id, "reason": "no_commit"},
            )
        except Release.DoesNotExist:
            cache.set(cache_key, True, timedelta(days=1).total_seconds())
            logger.info(
                "process_suspect_commits.skipped",
                extra={"event": event_id, "reason": "no_release"},
            )


@instrumented_task(
    name="sentry.tasks.process_suspect_commits",
    queue="group_owners.process_suspect_commits",
    default_retry_delay=5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry
def process_suspect_commits(
    event_id,
    event_platform,
    event_frames,
    group_id,
    project_id,
    sdk_name=None,
    **kwargs,
):
    lock = locks.get(
        f"process-suspect-commits:{group_id}", duration=10, name="process_suspect_commits"
    )
    try:
        with lock.acquire():
            _process_suspect_commits(
                event_id,
                event_platform,
                event_frames,
                group_id,
                project_id,
                sdk_name,
                **kwargs,
            )
    except UnableToAcquireLock:
        pass
