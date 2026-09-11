from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

from pydantic import BaseModel, Field

RESPONSE_VERSION: Literal[1] = 1


class MonitorPropertyValue(BaseModel):
    monitor_id: int
    value: str


class MonitorPropertyComparison(BaseModel):
    property: str
    values: list[MonitorPropertyValue]


class MonitorFinding(BaseModel):
    kind: Literal["exact_duplicate", "overlapping_coverage", "duplicate_notifications"]
    monitor_ids: list[int]
    suggested_keep_id: int | None = None
    alert_ids: list[int] = Field(default_factory=list)
    reason: str
    comparison: list[MonitorPropertyComparison] = Field(default_factory=list)


class MonitorCleanupArtifact(BaseModel):
    scan_status: Literal["complete", "partial"]
    monitors_scanned: int
    summary: str
    findings: list[MonitorFinding]


class ProjectMonitorCleanupArtifact(MonitorCleanupArtifact):
    project_id: int


class OrganizationMonitorCleanupArtifact(BaseModel):
    scan_status: Literal["complete", "partial"]
    projects: list[ProjectMonitorCleanupArtifact]


class MonitorCleanupResponseV1(BaseModel):
    schema_version: Literal[1]
    data: OrganizationMonitorCleanupArtifact


class MonitorCleanupOutput(TypedDict):
    outputKind: Literal["monitor_cleanup"]
    schemaVersion: Literal[1]
    projectId: str
    projectSlug: NotRequired[str]
    scan: MonitorCleanupScan
    summary: str
    findings: list[MonitorCleanupFinding]


class MonitorCleanupScan(TypedDict):
    status: Literal["complete", "partial"]
    monitorsScanned: int


class MonitorCleanupFinding(TypedDict):
    kind: Literal["exact_duplicate", "overlapping_coverage", "duplicate_notifications"]
    monitors: list[MonitorCleanupResource]
    suggestedKeepId: str | None
    alerts: list[MonitorCleanupResource]
    reason: str
    comparison: list[MonitorCleanupComparison]


class MonitorCleanupResource(TypedDict):
    id: str
    name: str
    enabled: bool


class MonitorCleanupComparison(TypedDict):
    property: str
    values: list[MonitorCleanupComparisonValue]


class MonitorCleanupComparisonValue(TypedDict):
    monitorId: str
    value: str


class MonitorCleanupRunExtras(TypedDict):
    status: Literal["running", "complete", "partial", "failed"]
    date_completed: str | None
    error: str | None
    response_schema_version: Literal[1]
    project_ids: list[str]
    results: list[MonitorCleanupOutput]


class MonitorCleanupRunResponse(TypedDict):
    id: str
    dateAdded: str
    dateCompleted: str | None
    strategy: Literal["duplicate_monitors"]
    extras: MonitorCleanupRunStatus
    errorMessage: str | None
    results: list[MonitorCleanupResultResponse]


class MonitorCleanupRunStatus(TypedDict):
    status: Literal["running", "complete", "partial", "failed"]


class MonitorCleanupResultResponse(TypedDict):
    id: str
    kind: Literal["duplicate_monitors"]
    seerRunId: str
    extras: MonitorCleanupOutput
