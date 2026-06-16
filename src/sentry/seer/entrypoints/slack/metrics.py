from __future__ import annotations

from enum import StrEnum


class ProcessMentionHaltReason(StrEnum):
    IDENTITY_NOT_LINKED = "identity_not_linked"
    USER_NOT_ORG_MEMBER = "user_not_org_member"


class ProcessMentionFailureReason(StrEnum):
    ORG_NOT_FOUND = "org_not_found"
    NO_AGENT_ACCESS = "no_agent_access"


class ProcessReactionHaltReason(StrEnum):
    IDENTITY_NOT_LINKED = "identity_not_linked"
    NOT_BOT_MESSAGE = "not_bot_message"
    UNSUPPORTED_REACTION = "unsupported_reaction"
    NO_AGENT_ACCESS = "no_agent_access"
    THREAD_NOT_FOUND = "thread_not_found"


class ProcessReactionFailureReason(StrEnum):
    ORG_NOT_FOUND = "org_not_found"
    INTEGRATION_NOT_FOUND = "integration_not_found"
    INSTALLATION_NOT_FOUND = "installation_not_found"
