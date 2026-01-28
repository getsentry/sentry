from enum import StrEnum


class GitLabIssueAction(StrEnum):
    UPDATE = "update"
    OPEN = "open"
    REOPEN = "reopen"
    CLOSE = "close"

    @classmethod
    def values(cls):
        return [action.value for action in cls]
