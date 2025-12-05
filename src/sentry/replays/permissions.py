from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberreplayaccess import OrganizationMemberReplayAccess

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.users.models.user import User


def has_replay_permission(organization: Organization, user: User | AnonymousUser | None) -> bool:
    """
    Check if a user has permission to access replay data for an organization. This
    change is backwards compatible with the existing behavior and introduces the
    ability to granularly control replay access for organization members, irrespective
    of their role.

    Logic:
    - If feature flag is disabled, return True (existing behavior, everyone has access)
    - User must be authenticated and a member of the org
    - If no allowlist records exist for org, return True for all members
    - If allowlist records exist, check if user's org membership is in the allowlist
    - Return True if user is in allowlist, False otherwise
    """
    if not features.has("organizations:granular-replay-permissions", organization):
        return True

    if user is None or not user.is_authenticated:
        return False

    try:
        member = OrganizationMember.objects.get(organization=organization, user_id=user.id)
    except OrganizationMember.DoesNotExist:
        return False

    allowlist_exists = OrganizationMemberReplayAccess.objects.filter(
        organization=organization
    ).exists()

    if not allowlist_exists:
        return True

    has_access = OrganizationMemberReplayAccess.objects.filter(
        organization=organization, organizationmember=member
    ).exists()

    return has_access
