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
        "POST": ["org:admin"],
        "DELETE": ["org:admin"],
    }
