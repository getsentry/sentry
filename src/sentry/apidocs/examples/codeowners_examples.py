from drf_spectacular.utils import OpenApiExample

PROJECT_CODEOWNERS_RESPONSE = {
    "id": "42",
    "raw": "src/* user@example.com",
    "dateCreated": "2024-01-15T10:30:00Z",
    "dateUpdated": "2024-01-15T10:30:00Z",
    "dateSynced": "2024-01-15T10:30:00Z",
    "codeMappingId": "7",
    "provider": "github",
    "errors": {
        "missing_external_teams": [],
        "missing_external_users": [],
        "missing_user_emails": [],
        "teams_without_access": [],
        "users_without_access": [],
    },
    "schema": {
        "$version": 1,
        "rules": [
            {
                "matcher": {"type": "codeowners", "pattern": "src/*"},
                "owners": [{"type": "user", "id": "1", "name": "user@example.com"}],
            }
        ],
    },
    "codeOwnersUrl": "https://github.com/example/repository/blob/main/CODEOWNERS",
}

PROJECT_CODEOWNERS_RESPONSE_WITH_OWNERSHIP_SYNTAX = {
    **PROJECT_CODEOWNERS_RESPONSE,
    "ownershipSyntax": "codeowners:src/* user@example.com\n",
}

LIST_PROJECT_CODEOWNERS = [
    OpenApiExample(
        "List a project's CODEOWNERS configurations",
        value=[PROJECT_CODEOWNERS_RESPONSE],
        status_codes=["200"],
        response_only=True,
    )
]

CREATE_PROJECT_CODEOWNERS = [
    OpenApiExample(
        "Create a CODEOWNERS configuration",
        value={"raw": "src/* user@example.com", "codeMappingId": "7"},
        request_only=True,
    ),
    OpenApiExample(
        "Created CODEOWNERS configuration",
        value=PROJECT_CODEOWNERS_RESPONSE_WITH_OWNERSHIP_SYNTAX,
        status_codes=["201"],
        response_only=True,
    ),
]
