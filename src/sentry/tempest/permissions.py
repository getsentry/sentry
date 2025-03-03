from sentry.api.bases.project import ProjectPermission


class TempestCredentialsPermission(ProjectPermission):
    scope_map = {
        "GET": [
            "project:read",
            "project:write",
            "project:admin",
            "org:read",
            "org:write",
            "org:admin",
        ],
        "POST": ["org:admin", "org:write", "project:admin", "project:write"],
        "DELETE": ["org:admin", "org:write", "project:admin", "project:write"],
    }
