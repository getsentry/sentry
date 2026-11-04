from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features
from sentry.models.organization import Organization

if TYPE_CHECKING:
    from sentry.auth.principal import RequestPrincipal

INVESTIGATIONS_FEATURE = "organizations:investigations"
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
