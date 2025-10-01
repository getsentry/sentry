import logging
from datetime import UTC, datetime

from django.db import router

from sentry import options
from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange as OldCommitFileChange
from sentry.models.organization import Organization
from sentry.releases.models import Commit, CommitFileChange
from sentry.utils.db import atomic_transaction

logger = logging.getLogger(__name__)


def get_dual_write_start_date() -> datetime | None:
    """
    Get the dual-write start date from options.
    Returns None if not set or invalid.
    Always returns a timezone-aware datetime in UTC.
    """
    start_date_str = options.get("commit.dual-write-start-date")
    if not start_date_str:
        return None

    try:
        dt = datetime.fromisoformat(start_date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except (ValueError, TypeError):
        logger.exception(
            "get_dual_write_start_date.invalid_date",
            extra={"start_date_str": start_date_str},
        )
        return None


def _dual_write_commit(old_commit: OldCommit) -> Commit:
    """Helper to create or ensure a commit exists in the new table if dual write is enabled."""
    commit_data = {
        "organization_id": old_commit.organization_id,
        "repository_id": old_commit.repository_id,
        "key": old_commit.key,
        "date_added": old_commit.date_added,
        "author": old_commit.author,
        "message": old_commit.message,
    }
    new_commit, created = Commit.objects.get_or_create(
        id=old_commit.id,
        defaults=commit_data,
    )
    if created:
        logger.info(
            "dual_write_commit_created",
            extra={
                "commit_id": old_commit.id,
                "commit_key": old_commit.key,
            },
        )
    return new_commit


def create_commit(
    organization: Organization,
    repo_id: int,
    key: str,
    message: str | None = None,
    author: CommitAuthor | None = None,
    date_added: datetime | None = None,
) -> tuple[OldCommit, Commit]:
    with atomic_transaction(
        using=(
            router.db_for_write(OldCommit),
            router.db_for_write(Commit),
        )
    ):
        commit_kwargs = {}
        if date_added is not None:
            commit_kwargs["date_added"] = date_added

        old_commit = OldCommit.objects.create(
            organization_id=organization.id,
            repository_id=repo_id,
            key=key,
            author=author,
            message=message,
            **commit_kwargs,
        )
        new_commit = _dual_write_commit(old_commit)
    return old_commit, new_commit


def get_or_create_commit(
    organization: Organization,
    repo_id: int,
    key: str,
    message: str | None = None,
    author: CommitAuthor | None = None,
    date_added: datetime | None = None,
) -> tuple[OldCommit, Commit, bool]:
    """
    Gets or creates a commit with dual write support.
    """
    defaults = {
        "author": author,
        "message": message,
    }
    if date_added is not None:
        defaults["date_added"] = date_added  # type: ignore[assignment]

    with atomic_transaction(
        using=(
            router.db_for_write(OldCommit),
            router.db_for_write(Commit),
        )
    ):
        old_commit, created = OldCommit.objects.get_or_create(
            organization_id=organization.id,
            repository_id=repo_id,
            key=key,
            defaults=defaults,
        )

        new_commit = _dual_write_commit(old_commit)

    return old_commit, new_commit, created


def update_commit(old_commit: OldCommit, new_commit: Commit, **fields) -> None:
    """Update a commit in both tables if dual write is enabled."""
    with atomic_transaction(
        using=(
            router.db_for_write(OldCommit),
            router.db_for_write(Commit),
        )
    ):
        old_commit.update(**fields)
        new_commit.update(**fields)


def bulk_create_commit_file_changes(
    file_changes: list[OldCommitFileChange],
) -> tuple[list[OldCommitFileChange], list[CommitFileChange]]:
    """
    Bulk creates commit file changes with dual write support.
    """
    if not file_changes:
        return [], []

    with atomic_transaction(
        using=(
            router.db_for_write(OldCommitFileChange),
            router.db_for_write(CommitFileChange),
        )
    ):
        old_file_changes = OldCommitFileChange.objects.bulk_create(
            file_changes,
            ignore_conflicts=True,
            batch_size=100,
        )
        new_file_changes = []
        # Since ignore_conflicts doesn't return IDs, fetch all file changes for the commits
        # and match them up by filename and type
        commit_ids = {fc.commit_id for fc in file_changes}

        existing_old_fcs = OldCommitFileChange.objects.filter(
            commit_id__in=commit_ids,
        )
        existing_lookup = {
            (old_fc.commit_id, old_fc.filename, old_fc.type): old_fc for old_fc in existing_old_fcs
        }

        new_file_change_objects = []
        for fc in file_changes:
            key = (fc.commit_id, fc.filename, fc.type)
            if key in existing_lookup:
                old_fc = existing_lookup[key]
                new_file_change_objects.append(
                    CommitFileChange(
                        id=old_fc.id,
                        organization_id=old_fc.organization_id,
                        commit_id=old_fc.commit_id,
                        filename=old_fc.filename,
                        type=old_fc.type,
                    )
                )

        if new_file_change_objects:
            new_file_changes = CommitFileChange.objects.bulk_create(
                new_file_change_objects,
                ignore_conflicts=True,
                batch_size=100,
            )

    return old_file_changes, new_file_changes
