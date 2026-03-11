from sentry.api.bases.organization import OrganizationPermission


class ProjectTransactionThresholdOverridePermission(OrganizationPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:write", "project:admin"],
        "PUT": ["project:write", "project:admin"],
        "DELETE": ["project:write", "project:admin"],
    }
