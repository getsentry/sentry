from __future__ import annotations

from collections.abc import Collection
from typing import TYPE_CHECKING

from sentry import features
from sentry.models.organization import Organization

if TYPE_CHECKING:
    from sentry.auth.access import Access, ServiceAccountAccess
    from sentry.auth.principal import RequestPrincipal

NOTEBOOKS_FEATURE = "organizations:investigations"
ISSUE_LINKS_FEATURE = "organizations:investigations-issue-links"
# Any one of these lets a member read and manage investigations.
NOTEBOOK_SCOPES = frozenset({"org:read", "org:write", "org:admin"})


def has_notebooks_access(organization: Organization, actor: RequestPrincipal | None = None) -> bool:
    """Whether investigations are available to `actor` in `organization`.

    Investigations read across every project, so they also need open membership.
    """
    return features.has(NOTEBOOKS_FEATURE, organization, actor=actor) and bool(
        organization.flags.allow_joinleave
    )


def service_account_reaches(access: ServiceAccountAccess, project_ids: Collection[int]) -> bool:
    """Whether a service account can work on these projects. No projects means every project."""
    if project_ids:
        return set(project_ids).issubset(access.accessible_project_ids)
    return access.has_all_projects


def issue_links_enabled(organization: Organization, actor: RequestPrincipal | None = None) -> bool:
    """Whether investigations record, and `actor` sees, the issues they link."""
    return features.has(ISSUE_LINKS_FEATURE, organization, actor=actor) and (
        has_notebooks_access(organization, actor)
    )


def can_view_issue_links(
    organization: Organization, actor: RequestPrincipal | None, access: Access
) -> bool:
    """Issue activity only needs `event:read`; links also need the investigation scope."""
    return issue_links_enabled(organization, actor) and any(
        access.has_scope(scope) for scope in NOTEBOOK_SCOPES
    )
