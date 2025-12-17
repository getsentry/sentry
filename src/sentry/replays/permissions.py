from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationmember import OrganizationMember
from sentry.replays.models import OrganizationMemberReplayAccess

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.users.models.user import User


def has_replay_permission(organization: Organization, user: User | AnonymousUser) -> bool:
    """
    Determine whether a user has permission to access replay data for a given organization.

    Rules:
    - Superusers always have access.
    - User must be authenticated and an active org member.
    - If the 'organizations:granular-replay-permissions' feature flag is OFF, all users have access.
    - If the 'sentry:granular-replay-permissions' org option is not set or falsy, all org members have access.
    - If no allowlist records exist for the organization but the feature flag is on, no one has access.
    - If allowlist records exist, only users explicitly present in the OrganizationMemberReplayAccess allowlist have access.
    - Returns True if allowed, False otherwise.
    """
    if user.is_superuser:
        return True

    if not features.has("organizations:granular-replay-permissions", organization):
        return True

    member = OrganizationMember.objects.get(organization=organization, user_id=user.id)

    org_option = OrganizationOption.objects.filter(
        organization=organization, key="sentry:granular-replay-permissions"
    ).first()
    if not org_option or not org_option.value:
        return True

    allowlist_exists = OrganizationMemberReplayAccess.objects.filter(
        organizationmember__organization=organization
    ).exists()

    # if no allowlist records exist, return False to deny access to all members
    if not allowlist_exists:
        return False

    has_access = OrganizationMemberReplayAccess.objects.filter(organizationmember=member).exists()

    return has_access
