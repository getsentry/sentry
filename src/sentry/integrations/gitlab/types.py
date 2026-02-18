from enum import StrEnum


class GitLabIssueStatus(StrEnum):
    OPENED = "opened"
    CLOSED = "closed"

    @classmethod
    def get_choices(cls):
        """Return choices formatted for dropdown selectors"""
        return [(status.value, status.value.capitalize()) for status in cls]


class GitLabIssueAction(StrEnum):
    UPDATE = "update"
    OPEN = "open"
    REOPEN = "reopen"

    @classmethod
    def values(cls):
        return [action.value for action in cls]
