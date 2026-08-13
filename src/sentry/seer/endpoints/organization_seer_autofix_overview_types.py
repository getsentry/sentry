from __future__ import annotations

from datetime import datetime
from typing import TypedDict


class PullRequestFilePayload(TypedDict):
    path: str
    additions: int
    deletions: int
    changeType: str


class PullRequestPayload(TypedDict):
    number: int
    url: str | None
    status: str | None
    checksStatus: str | None
    reviewStatus: str | None
    files: list[PullRequestFilePayload]


class IssueProjectPayload(TypedDict):
    id: str
    slug: str
    platform: str | None


class IssuePayload(TypedDict):
    count: int | None
    userCount: int | None
    lastSeen: str | None
    level: str | None
    substatus: str | None
    priority: str | None
    priorityLockedAt: str | None
    issueType: str | None
    issueCategory: str | None
    assignedTo: dict | None
    owners: list
    project: IssueProjectPayload


class RootCausePayload(TypedDict):
    oneLineDescription: str | None


class ProposedFixPayload(TypedDict):
    oneLineSummary: str | None


class RunPayload(TypedDict):
    groupId: str
    shortId: str
    title: str
    rootCause: RootCausePayload | None
    proposedFix: ProposedFixPayload | None
    seerRunId: str
    lastTriggeredAt: datetime
    pullRequests: list[PullRequestPayload]
    issue: IssuePayload


class OverviewResponse(TypedDict):
    runsByMilestone: dict[str, list[RunPayload]]
