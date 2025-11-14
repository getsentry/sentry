from typing import int
from sentry.api.bases.organization import OrganizationPermission
from sentry.auth.superuser import is_active_superuser, superuser_has_permission

MISSING_FEATURE_MESSAGE = "Your organization does not have access to this feature."
ERR_RATE_LIMITED = "You are being rate limited for too many invitations."


class MemberInviteDetailsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        # DELETE checks for role comparison as you can either remove a member invite request
        # you added, or any member invite / invite request if you have the required scopes
        "DELETE": ["member:read", "member:write", "member:admin"],
    }

    def has_object_permission(self, request, view, organization):
        """
        Prevents superuser read from deleting an invite or invite request.
        """
        has_perms = super().has_object_permission(request, view, organization)
        if is_active_superuser(request) and not superuser_has_permission(request):
            return False
        return has_perms
