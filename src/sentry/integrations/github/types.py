from enum import StrEnum


class IssueEvenntWebhookActionType(StrEnum):
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    CLOSED = "closed"
    REOPENED = "reopened"


class GitHubIssueStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"

    @classmethod
    def get_choices(cls) -> list[tuple[str, str]]:
        """Return choices formatted for dropdown selectors"""
        return [(status.value, status.value.capitalize()) for status in cls]
