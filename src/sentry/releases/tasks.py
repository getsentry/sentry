import logging

from django.core.cache import cache
from django.db import router

from sentry.locks import locks
from sentry.models.commit import Commit as OldCommit
from sentry.models.commitfilechange import CommitFileChange as OldCommitFileChange
from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.releases.models import Commit, CommitFileChange
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import Retry
from sentry.utils.db import atomic_transaction
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.sdk import bind_organization_context

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.releases.tasks.backfill_commits_for_release_async",
    queue="commits",
    max_retries=3,
    default_retry_delay=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        processing_deadline_duration=5 * 60,
        retry=Retry(
            times=3,
            delay=60,
        ),
    ),
)
def backfill_commits_for_release(
    organization_id: int,
    release_id: int,
) -> None:
    try:
        organization = Organization.objects.get(id=organization_id)
        Release.objects.get(id=release_id)
    except (Organization.DoesNotExist, Release.DoesNotExist):
        logger.exception(
            "backfill_commits_for_release_async.missing_objects",
            extra={
                "organization_id": organization_id,
                "release_id": release_id,
            },
        )
        return

    bind_organization_context(organization)

    cache_key = f"commit-backfill:release:{release_id}"
    if cache.get(cache_key):
        logger.info(
            "backfill_commits_for_release_async.already_processed",
            extra={
                "organization_id": organization.id,
                "release_id": release_id,
            },
        )
        return

    lock = locks.get(
        f"commit-backfill-lock:release:{release_id}", duration=300, name="commit_backfill"
    )
    try:
        with (
            lock.acquire(),
            atomic_transaction(
                using=(
                    router.db_for_write(OldCommit),
                    router.db_for_write(OldCommitFileChange),
                    router.db_for_write(Commit),
                    router.db_for_write(CommitFileChange),
                )
            ),
        ):
            old_commits = OldCommit.objects.filter(releasecommit__release_id=release_id)
            commits_to_backfill = [
                Commit(
                    id=old_commit.id,
                    organization_id=old_commit.organization_id,
                    repository_id=old_commit.repository_id,
                    key=old_commit.key,
                    date_added=old_commit.date_added,
                    author=old_commit.author,
                    message=old_commit.message,
                )
                for old_commit in old_commits
            ]

            commit_ids = [c.id for c in old_commits]
            old_file_changes = OldCommitFileChange.objects.filter(commit_id__in=commit_ids)

            file_changes_to_backfill = [
                CommitFileChange(
                    id=old_fc.id,
                    organization_id=old_fc.organization_id,
                    commit_id=old_fc.commit_id,
                    filename=old_fc.filename,
                    type=old_fc.type,
                )
                for old_fc in old_file_changes
            ]

            if commits_to_backfill:
                Commit.objects.bulk_create(commits_to_backfill, ignore_conflicts=True)
                logger.info(
                    "backfill_commits_for_release_async.commits_backfilled",
                    extra={
                        "organization_id": organization.id,
                        "release_id": release_id,
                        "count": len(commits_to_backfill),
                    },
                )

            if file_changes_to_backfill:
                CommitFileChange.objects.bulk_create(
                    file_changes_to_backfill, ignore_conflicts=True
                )
                logger.info(
                    "backfill_commits_for_release_async.file_changes_backfilled",
                    extra={
                        "organization_id": organization.id,
                        "release_id": release_id,
                        "count": len(file_changes_to_backfill),
                    },
                )

            cache.set(cache_key, True, 60 * 60 * 24 * 7)
            logger.info(
                "backfill_commits_for_release_async.completed",
                extra={
                    "organization_id": organization.id,
                    "release_id": release_id,
                    "commits_backfilled": len(commits_to_backfill),
                    "file_changes_backfilled": len(file_changes_to_backfill),
                },
            )
    except UnableToAcquireLock:
        # If another process is running this we can just exit
        pass
