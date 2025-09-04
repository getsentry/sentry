import logging
from datetime import datetime

from django.db import router

from sentry import features
from sentry.models.commit import Commit as OldCommit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.organization import Organization
from sentry.releases.models import Commit
from sentry.utils.db import atomic_transaction

logger = logging.getLogger(__name__)


def create_commit(
    organization: Organization,
    repo_id: int,
    key: str,
    message: str | None = None,
    author: CommitAuthor | None = None,
    date_added: datetime | None = None,
) -> tuple[OldCommit, Commit | None]:
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
        new_commit = None
        if features.has("organizations:commit-retention-dual-writing", organization):
            try:
                new_commit = Commit.objects.create(
                    id=old_commit.id,
                    organization_id=old_commit.organization_id,
                    repository_id=old_commit.repository_id,
                    key=old_commit.key,
                    date_added=old_commit.date_added,
                    author=old_commit.author,
                    message=old_commit.message,
                )
            except Exception:
                logger.exception("Failed to dual write to releases.Commit")
    return old_commit, new_commit
