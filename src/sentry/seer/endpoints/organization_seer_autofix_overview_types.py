from __future__ import annotations

from datetime import datetime
from typing import NotRequired, TypedDict

from sentry.seer.agent.client_models import FilePatch


class PullRequestFilePayload(TypedDict):
    path: str
    additions: int
    deletions: int
    changeType: str


class PullRequestPayload(TypedDict):
    id: str
    number: int
    url: str | None
    status: str | None
    checksStatus: str | None
    reviewStatus: str | None
    repoName: str | None
    files: list[PullRequestFilePayload]
    failedChecks: list[str]


class IssueProjectPayload(TypedDict):
    id: str
    slug: str
    platform: str | None
    hasReposConnected: NotRequired[bool]
    hasNonGithubRepo: NotRequired[bool]


class IssuePayload(TypedDict):
    count: str | None
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


class CodeChangeFilePayload(TypedDict):
    repoName: str
    patch: FilePatch


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
    codeChanges: list[CodeChangeFilePayload]
    issue: IssuePayload
    status: str | None


class OverviewResponse(TypedDict):
    runsByMilestone: dict[str, list[RunPayload]]
    truncatedMilestones: list[str]
