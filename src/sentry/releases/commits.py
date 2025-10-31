import logging

from sentry.models.commit import Commit as OldCommit
from sentry.releases.models import Commit

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
