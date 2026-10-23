from __future__ import annotations

from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

INVESTIGATIONS_FEATURE = "organizations:investigations"


def has_investigations_access(
    organization: Organization, actor: User | RpcUser | AnonymousUser | None = None
) -> bool:
    """Whether investigations are available to `actor` in `organization`.

    Investigations read across every project, so they also need open membership.
    """
    return features.has(INVESTIGATIONS_FEATURE, organization, actor=actor) and bool(
        organization.flags.allow_joinleave
    )
