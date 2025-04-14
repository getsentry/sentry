from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationPermission


class MemberInviteDetailsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        # DELETE checks for role comparison as you can either remove a member invite request
        # you added, or any member invite / invite request if you have the required scopes
        "DELETE": ["member:read", "member:write", "member:admin"],
    }

    # Allow deletions to happen for disabled members so they can remove themselves
    # allowing other methods should be fine as well even if we don't strictly need to allow them
    def is_member_disabled_from_limit(self, request: Request, organization):
        return False
