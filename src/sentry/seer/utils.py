from __future__ import annotations

import logging

from cryptography.fernet import Fernet
from django.conf import settings
from django.db.models import Q, QuerySet

from sentry.constants import ObjectStatus
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.models.commitauthor import CommitAuthor
from sentry.models.repository import Repository
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def encrypt_access_token_for_seer(access_token: str) -> str | None:
    """Fernet-encrypt an access token for transport to Seer."""
    if not settings.SEER_GHE_ENCRYPT_KEY:
        logger.error("Cannot encrypt access token without SEER_GHE_ENCRYPT_KEY")
        return None

    try:
        fernet = Fernet(settings.SEER_GHE_ENCRYPT_KEY.encode("utf-8"))
        return fernet.encrypt(access_token.encode("utf-8")).decode("utf-8")
    except Exception:
        logger.exception("Failed to encrypt access token")
        return None


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


def get_github_username_for_user(
    user: User | RpcUser, organization_id: int, *, referrer: str = "unknown"
) -> str | None:
    """
    Get GitHub username for a user by checking multiple sources.

    This function attempts to resolve a Sentry user to their GitHub username by:
    1. Checking ExternalActor for explicit user->GitHub mappings
    2. Falling back to CommitAuthor records matched by email (like suspect commits)
    3. Extracting the GitHub username from the CommitAuthor external_id

    ``referrer`` names the calling feature; it only tags the resolution metric
    so per-caller resolution rates stay separable.
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
        _record_username_resolution("external_actor", referrer)
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
                _record_username_resolution("commit_author", referrer)
                return commit_username

    _record_username_resolution("none", referrer)
    return None


def _record_username_resolution(source: str, referrer: str) -> None:
    metrics.incr(
        "seer.github_username_for_user",
        tags={"source": source, "referrer": referrer},
    )
