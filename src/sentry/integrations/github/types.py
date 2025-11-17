from enum import StrEnum


class IssueEvenntWebhookActionType(StrEnum):
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    CLOSED = "closed"
    REOPENED = "reopened"
