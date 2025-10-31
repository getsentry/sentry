import logging
from datetime import datetime

from django.db import router

from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.organization import Organization
from sentry.releases.models import Commit
from sentry.utils.db import atomic_transaction

logger = logging.getLogger(__name__)


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
