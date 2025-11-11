import logging
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any, cast

import sentry_sdk
from django.utils import timezone

from sentry import analytics
from sentry.analytics.events.groupowner_assignment import GroupOwnerAssignment
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.groupowner import GroupOwner, GroupOwnerType, SuspectCommitStrategy
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import Retry
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
TASK_DURATION_S = 90

logger = logging.getLogger(__name__)


def _process_suspect_commits(
    event_id,
    event_platform,
    event_frames: Sequence[Mapping[str, Any]],
    group_id,
    project_id,
    sdk_name=None,
    **kwargs,
):
    """
    This is the logic behind SuspectCommitStrategy.RELEASE_BASED
    """
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
            owner_commits: dict[str, int] = {}
            for committer in committers:
                author = cast(UserSerializerResponse, committer["author"])
                if author and "id" in author:
                    author_id = author["id"]
                    for commit, score in committer["commits"]:
                        if score >= MIN_COMMIT_SCORE:
                            current_score = owner_scores.get(author_id, 0)
                            if score > current_score:
                                owner_scores[author_id] = score
                                owner_commits[author_id] = commit.id

            if owner_scores:
                for owner_id, _ in sorted(
                    sorted(owner_scores.items(), reverse=True, key=lambda item: item[1])
                )[:PREFERRED_GROUP_OWNERS]:
                    try:
                        group_owner, created = (
                            GroupOwner.objects.update_or_create_and_preserve_context(
                                lookup_kwargs={
                                    "group_id": group_id,
                                    "type": GroupOwnerType.SUSPECT_COMMIT.value,
                                    "user_id": owner_id,
                                    "project_id": project.id,
                                    "organization_id": project.organization_id,
                                    "context__asjsonb__commitId": owner_commits[owner_id],
                                },
                                defaults={
                                    "date_added": timezone.now(),
                                },
                                context_defaults={
                                    "commitId": owner_commits[owner_id],
                                    "suspectCommitStrategy": SuspectCommitStrategy.RELEASE_BASED,
                                },
                            )
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
                            try:
                                analytics.record(
                                    GroupOwnerAssignment(
                                        organization_id=project.organization_id,
                                        project_id=project.id,
                                        group_id=group_id,
                                        new_assignment=created,
                                        user_id=group_owner.user_id,
                                        group_owner_type=group_owner.type,
                                        method="release_commit",
                                    )
                                )
                            except Exception as e:
                                sentry_sdk.capture_exception(e)

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
    namespace=issues_tasks,
    processing_deadline_duration=TASK_DURATION_S,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.REGION,
)
@retry
def process_suspect_commits(
    event_id,
    event_platform,
    event_frames: Sequence[Mapping[str, Any]],
    group_id,
    project_id,
    sdk_name=None,
    **kwargs,
):
    """
    This is the task behind SuspectCommitStrategy.RELEASE_BASED
    """
    lock = locks.get(
        f"process-suspect-commits:{group_id}",
        duration=TASK_DURATION_S,
        name="process_suspect_commits",
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
