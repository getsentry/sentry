from __future__ import annotations

from django.core.cache import cache

from sentry import options
from sentry.models.issuelabel import IssueLabel
from sentry.models.organizationlabel import OrganizationLabel


class IssueLabelCache:
    """
    Caches IssueLabel query results keyed by issue (group) ID.

    Uses Django's cache backend (Redis in production). TTL is controlled
    by the ``issues.issue-label-cache-ttl`` option (default 10 minutes).
    """

    KEY_PREFIX = "issuelabel:g"

    @classmethod
    def _make_key(cls, group_id: int) -> str:
        return f"{cls.KEY_PREFIX}:{group_id}"

    @classmethod
    def get(cls, group_id: int) -> list[IssueLabel] | None:
        """Return cached label list for the given issue, or None on cache miss."""
        return cache.get(cls._make_key(group_id))

    @classmethod
    def set(cls, group_id: int, values: list[IssueLabel]) -> None:
        """Store label list in cache for the given issue."""
        cache.set(cls._make_key(group_id), values, options.get("issues.issue-label-cache-ttl"))

    @classmethod
    def invalidate(cls, group_id: int) -> None:
        """Remove cached entry for the given issue."""
        cache.delete(cls._make_key(group_id))


class OrganizationLabelCache:
    """
    Caches OrganizationLabel query results keyed by organization ID.

    Uses Django's cache backend (Redis in production). TTL is controlled
    by the ``issues.org-label-cache-ttl`` option (default 10 minutes).
    """

    KEY_PREFIX = "orglabel:o"

    @classmethod
    def _make_key(cls, organization_id: int) -> str:
        return f"{cls.KEY_PREFIX}:{organization_id}"

    @classmethod
    def get(cls, organization_id: int) -> list[OrganizationLabel] | None:
        """Return cached label list for the given organization, or None on cache miss."""
        return cache.get(cls._make_key(organization_id))

    @classmethod
    def set(cls, organization_id: int, values: list[OrganizationLabel]) -> None:
        """Store label list in cache for the given organization."""
        cache.set(cls._make_key(organization_id), values, options.get("issues.org-label-cache-ttl"))

    @classmethod
    def invalidate(cls, organization_id: int) -> None:
        """Remove cached entry for the given organization."""
        cache.delete(cls._make_key(organization_id))
