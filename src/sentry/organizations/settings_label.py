from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features

if TYPE_CHECKING:
    from django.contrib.auth.models import AnonymousUser

    from sentry.models.organization import Organization
    from sentry.organizations.services.organization import RpcOrganization
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser

ORGANIZATION_SETTINGS_LABEL = "Organization Settings"
# The settings-v3 navigation titles the organization scope "Org Settings".
SETTINGS_V3_ORGANIZATION_SETTINGS_LABEL = "Org Settings"


def get_organization_settings_label(
    organization: Organization | RpcOrganization | None,
    actor: User | RpcUser | AnonymousUser | None,
) -> str:
    """
    The name of organization settings for text that points people at them, matching the
    navigation that `actor` sees. The flag rolls out by user email, so pass the person
    who reads the text.
    """
    if organization is not None and features.has(
        "organizations:settings-v3", organization, actor=actor
    ):
        return SETTINGS_V3_ORGANIZATION_SETTINGS_LABEL
    return ORGANIZATION_SETTINGS_LABEL
