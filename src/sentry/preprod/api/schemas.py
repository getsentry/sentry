from __future__ import annotations

from typing import Any

# Regex patterns
SHA_PATTERN = "^[0-9a-f]{40}$"
SHA_PATTERN_OPTIONAL_EMPTY = "^(|[0-9a-f]{40})$"

# Shared VCS schema properties
VCS_SCHEMA_PROPERTIES: dict[str, Any] = {
    "head_sha": {"type": "string", "pattern": SHA_PATTERN_OPTIONAL_EMPTY},
    "base_sha": {"type": "string", "pattern": SHA_PATTERN_OPTIONAL_EMPTY},
    "provider": {"type": "string", "maxLength": 255},
    "head_repo_name": {"type": "string", "maxLength": 255},
    "base_repo_name": {"type": "string", "maxLength": 255},
    "head_ref": {"type": "string", "maxLength": 255},
    "base_ref": {"type": "string", "maxLength": 255},
    "pr_number": {"type": "integer", "minimum": 1},
}

VCS_ERROR_MESSAGES: dict[str, str] = {
    "head_sha": "The head_sha field must be a 40-character hexadecimal SHA1 string (no uppercase letters).",
    "base_sha": "The base_sha field must be a 40-character hexadecimal SHA1 string (no uppercase letters).",
    "provider": "The provider field must be a string with maximum length of 255 characters containing the domain of the VCS provider (ex. github.com)",
    "head_repo_name": "The head_repo_name field must be a string with maximum length of 255 characters.",
    "base_repo_name": "The base_repo_name field must be a string with maximum length of 255 characters.",
    "head_ref": "The head_ref field must be a string with maximum length of 255 characters.",
    "base_ref": "The base_ref field must be a string with maximum length of 255 characters.",
    "pr_number": "The pr_number field must be a positive integer.",
}
