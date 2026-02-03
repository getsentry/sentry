from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.http import HttpRequest

from sentry import features
from sentry.auth.superuser import superuser_has_permission
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationmember import OrganizationMember
from sentry.models.orgauthtoken import is_org_auth_token_auth
from sentry.replays.models import OrganizationMemberReplayAccess
from sentry.sentry_apps.services.app import app_service

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def has_replay_permission(request: HttpRequest, organization: Organization) -> bool:
    """
    Determine whether a user has permission to access replay data for a given organization.

    Rules:
    - Superusers always have access.
    - Org auth tokens with event:read scope have access (replays are event data).
    - SentryApp proxy users with event:read scope have access (replays are event data).
    - If the 'organizations:granular-replay-permissions' feature flag is OFF, all users have access.
    - If the 'sentry:granular-replay-permissions' org option is not set or falsy, all org members have access.
    - If no allowlist records exist for the organization but the feature flag is on, no one has access.
    - If allowlist records exist, only users explicitly present in the OrganizationMemberReplayAccess allowlist have access.
    - Returns True if allowed, False otherwise.
    """
    if not features.has("organizations:granular-replay-permissions", organization):
        return True
    if superuser_has_permission(request):
        return True

    # Allow access if feature is turned off for org
    if granular_permissions_turned_off(organization):
        return True
    # Allow API access with org tokens
    auth = getattr(request, "auth", None)
    if is_org_auth_token_auth(auth) and auth.has_scope("event:read"):
        return True
    # Allow access to SentryApp with proxy user
    if is_sentry_app_with_permission(request.user, organization):
        return True

    # Decline access if user is not an org member
    member = get_org_member(organization, request)
    if not member:
        return False

    # Decline access if feature is on, but allowlist is empty
    allowlist_exists = OrganizationMemberReplayAccess.objects.filter(
        organizationmember__organization=organization
    ).exists()
    if not allowlist_exists:
        return False

    # Allow access to user on allowlist
    has_access = OrganizationMemberReplayAccess.objects.filter(organizationmember=member).exists()

    return has_access


def is_sentry_app_with_permission(user: Any, organization: Organization) -> bool:
    """Check if user is a SentryApp proxy user with event:read scope."""
    # SentryApp proxy users get access based on their scopes, not member allowlist.
    # Replays are event data, so event:read scope grants replay access.
    if not getattr(user, "is_sentry_app", False):
        return False
    installation = app_service.find_installation_by_proxy_user(
        proxy_user_id=user.id, organization_id=organization.id
    )
    if installation is None:
        return False
    return "event:read" in installation.sentry_app.scope_list


def granular_permissions_turned_off(organization: Organization) -> bool:
    """Check if granular replay permissions are disabled for the organization."""
    org_option = OrganizationOption.objects.filter(
        organization=organization, key="sentry:granular-replay-permissions"
    ).first()
    return not org_option or not org_option.value


def get_org_member(organization: Organization, request: HttpRequest) -> OrganizationMember | None:
    """Get the OrganizationMember for the request user, or None if not a member."""
    try:
        return OrganizationMember.objects.get(organization=organization, user_id=request.user.id)
    except OrganizationMember.DoesNotExist:
        return None
