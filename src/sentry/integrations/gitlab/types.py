from enum import StrEnum


class GitLabIssueAction(StrEnum):
    UPDATE = "update"
    OPEN = "open"
    REOPEN = "reopen"
    CLOSE = "close"

    @classmethod
    def values(cls) -> list[str]:
        return [action.value for action in cls]


class GitLabIssueStatus(StrEnum):
    OPENED = "opened"
    CLOSED = "closed"

    @classmethod
    def get_choices(cls) -> list[tuple[str, str]]:
        """Return choices formatted for dropdown selectors"""
        return [(status.value, status.value.capitalize()) for status in cls]
