from __future__ import annotations

from sentry.models.commitauthor import COMMIT_AUTHOR_EMAIL_LENGTH, CommitAuthor


def get_or_create_commit_author(organization_id: int, email: str, name: str) -> CommitAuthor | None:
    if not email or len(email) > COMMIT_AUTHOR_EMAIL_LENGTH:
        return None

    author, _ = CommitAuthor.objects.get_or_create(
        organization_id=organization_id,
        email=email,
        defaults={"name": name[:128]},
    )
    return author
