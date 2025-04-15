from sentry.api.bases.organization import OrganizationPermission


class MemberInviteDetailsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        # DELETE checks for role comparison as you can either remove a member invite request
        # you added, or any member invite / invite request if you have the required scopes
        "DELETE": ["member:read", "member:write", "member:admin"],
    }
