from __future__ import annotations

from enum import StrEnum


class ProcessMentionHaltReason(StrEnum):
    ORG_NOT_FOUND = "org_not_found"
    NO_EXPLORER_ACCESS = "no_explorer_access"
    IDENTITY_NOT_LINKED = "identity_not_linked"
