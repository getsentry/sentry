from __future__ import annotations

from enum import StrEnum


class ProcessMentionHaltReason(StrEnum):
    IDENTITY_NOT_LINKED = "identity_not_linked"
    USER_NOT_ORG_MEMBER = "user_not_org_member"


class ProcessMentionFailureReason(StrEnum):
    ORG_NOT_FOUND = "org_not_found"
    NO_EXPLORER_ACCESS = "no_explorer_access"
