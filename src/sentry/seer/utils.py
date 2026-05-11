from __future__ import annotations

from django.db.models import Q, QuerySet

from sentry.constants import ObjectStatus
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.models.commitauthor import CommitAuthor
from sentry.models.repository import Repository
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


def filter_repo_by_provider(
    organization_id: int,
    provider: str,
    external_id: str,
    owner: str,
    name: str,
) -> QuerySet[Repository]:
    """
    Filter for an active repository by its provider, external ID, and owner/name.
    """
    return Repository.objects.filter(
        Q(provider=provider) | Q(provider=f"integrations:{provider}"),
        organization_id=organization_id,
        external_id=external_id,
        name=f"{owner}/{name}",
        status=ObjectStatus.ACTIVE,
    )


def get_github_username_for_user(user: User | RpcUser, organization_id: int) -> str | None:
    """
    Get GitHub username for a user by checking multiple sources.

    This function attempts to resolve a Sentry user to their GitHub username by:
    1. Checking ExternalActor for explicit user->GitHub mappings
    2. Falling back to CommitAuthor records matched by email (like suspect commits)
    3. Extracting the GitHub username from the CommitAuthor external_id
    """
    # Method 1: Check ExternalActor for direct user->GitHub mapping
    external_actor: ExternalActor | None = (
        ExternalActor.objects.filter(
            user_id=user.id,
            organization_id=organization_id,
            provider__in=[
                ExternalProviders.GITHUB.value,
                ExternalProviders.GITHUB_ENTERPRISE.value,
            ],
        )
        .order_by("-date_added")
        .first()
    )

    if external_actor and external_actor.external_name:
        username = external_actor.external_name
        return username[1:] if username.startswith("@") else username

    # Method 2: Check CommitAuthor by email matching (like suspect commits does)
    # Get all verified emails for this user
    user_emails: list[str] = []
    try:
        # Both User and RpcUser models have a get_verified_emails method
        if hasattr(user, "get_verified_emails"):
            verified_emails = user.get_verified_emails()
            user_emails.extend([e.email for e in verified_emails])
    except Exception:
        # If we can't get verified emails, don't use any
        pass

    if user_emails:
        # Find CommitAuthors with matching emails that have GitHub external_id
        commit_author = (
            CommitAuthor.objects.filter(
                organization_id=organization_id,
                email__in=[email.lower() for email in user_emails],
                external_id__isnull=False,
            )
            .exclude(external_id="")
            .order_by("-id")
            .first()
        )

        if commit_author:
            commit_username = commit_author.get_username_from_external_id()
            if commit_username:
                return commit_username

    return None
