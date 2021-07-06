from sentry.api.bases.organization import OrganizationPermission


class ProjectTransactionThresholdOverridePermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
        "PUT": ["org:read"],
        "DELETE": ["org:read"],
    }
