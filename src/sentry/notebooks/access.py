from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features
from sentry.models.organization import Organization

if TYPE_CHECKING:
    from sentry.auth.access import Access
    from sentry.auth.principal import RequestPrincipal

INVESTIGATIONS_FEATURE = "organizations:investigations"
ISSUE_LINKS_FEATURE = "organizations:investigations-issue-links"
# Any one of these lets a member read and manage investigations.
INVESTIGATION_SCOPES = frozenset({"org:read", "org:write", "org:admin"})


def has_investigations_access(
    organization: Organization, actor: RequestPrincipal | None = None
) -> bool:
    """Whether investigations are available to `actor` in `organization`.

    Investigations read across every project, so they also need open membership.
    """
    return features.has(INVESTIGATIONS_FEATURE, organization, actor=actor) and bool(
        organization.flags.allow_joinleave
    )


def issue_links_enabled(organization: Organization, actor: RequestPrincipal | None = None) -> bool:
    """Whether investigations record, and `actor` sees, the issues they link."""
    return features.has(ISSUE_LINKS_FEATURE, organization, actor=actor) and (
        has_investigations_access(organization, actor)
    )


def can_view_issue_links(
    organization: Organization, actor: RequestPrincipal | None, access: Access
) -> bool:
    """Issue activity only needs `event:read`; links also need the investigation scope."""
    return issue_links_enabled(organization, actor) and any(
        access.has_scope(scope) for scope in INVESTIGATION_SCOPES
    )
