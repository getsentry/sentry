from __future__ import annotations

from typing import Any

from sentry.apidocs.formats import GIT_REF_MAX_LENGTH, GIT_REF_PATTERN_OPTIONAL_EMPTY

# Regex patterns
SHA_PATTERN = "^[0-9a-f]{40}$"
SHA_PATTERN_OPTIONAL_EMPTY = "^(|[0-9a-f]{40})$"

# Shared VCS schema properties
VCS_SCHEMA_PROPERTIES: dict[str, Any] = {
    "head_sha": {
        "type": "string",
        "pattern": SHA_PATTERN_OPTIONAL_EMPTY,
        "description": "SHA of the commit the build was made from.",
    },
    "base_sha": {
        "type": "string",
        "pattern": SHA_PATTERN_OPTIONAL_EMPTY,
        "description": "SHA of the commit to compare against, such as the merge base of a pull request. Requires `head_sha`.",
    },
    "provider": {
        "type": "string",
        "maxLength": 255,
        "description": "VCS provider of the repository, such as `github`.",
    },
    "head_repo_name": {
        "type": "string",
        "maxLength": 255,
        "description": "Name of the repository the build was made from, such as `owner/repo`.",
    },
    "base_repo_name": {
        "type": "string",
        "maxLength": 255,
        "description": "Name of the repository of the base commit, such as `owner/repo`.",
    },
    "head_ref": {
        "type": "string",
        "maxLength": GIT_REF_MAX_LENGTH,
        "pattern": GIT_REF_PATTERN_OPTIONAL_EMPTY,
        "description": "Branch or ref the build was made from, such as `feature/xyz`.",
    },
    "base_ref": {
        "type": "string",
        "maxLength": GIT_REF_MAX_LENGTH,
        "pattern": GIT_REF_PATTERN_OPTIONAL_EMPTY,
        "description": "Branch or ref of the base commit, such as `main`.",
    },
    "pr_number": {
        "type": "integer",
        "minimum": 1,
        "description": "Number of the pull request the build belongs to.",
    },
}

VCS_ERROR_MESSAGES: dict[str, str] = {
    "head_sha": "The head_sha field must be a 40-character hexadecimal SHA1 string (no uppercase letters).",
    "base_sha": "The base_sha field must be a 40-character hexadecimal SHA1 string (no uppercase letters).",
    "provider": "The provider field must be a string with maximum length of 255 characters containing the domain of the VCS provider (ex. github.com)",
    "head_repo_name": "The head_repo_name field must be a string with maximum length of 255 characters.",
    "base_repo_name": "The base_repo_name field must be a string with maximum length of 255 characters.",
    "head_ref": "The head_ref field must be a valid git ref name (such as main or feature/xyz) with maximum length of 255 characters.",
    "base_ref": "The base_ref field must be a valid git ref name (such as main or feature/xyz) with maximum length of 255 characters.",
    "pr_number": "The pr_number field must be a positive integer.",
}
