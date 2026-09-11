from __future__ import annotations

from datetime import datetime
from typing import Literal, NotRequired, TypedDict

from pydantic import BaseModel, Field


class SeerMonitorPropertyValue(BaseModel):
    monitor_id: int
    value: str


class SeerMonitorPropertyComparison(BaseModel):
    property: str
    values: list[SeerMonitorPropertyValue]


class SeerMonitorFinding(BaseModel):
    kind: Literal["exact_duplicate", "overlapping_coverage", "duplicate_notifications"]
    monitor_ids: list[int]
    suggested_keep_id: int | None = None
    alert_ids: list[int] = Field(default_factory=list)
    reason: str
    comparison: list[SeerMonitorPropertyComparison] = Field(default_factory=list)


class SeerMonitorCleanupArtifact(BaseModel):
    scan_status: Literal["complete", "partial"]
    monitors_scanned: int
    summary: str
    findings: list[SeerMonitorFinding]


class SeerProjectMonitorCleanupArtifact(SeerMonitorCleanupArtifact):
    project_id: int


class SeerOrganizationMonitorCleanupArtifact(BaseModel):
    scan_status: Literal["complete", "partial"]
    projects: list[SeerProjectMonitorCleanupArtifact]


class SeerMonitorCleanupResponse(BaseModel):
    schema_version: Literal[1]
    data: SeerOrganizationMonitorCleanupArtifact


# Sentry-built results and run extras: TypedDict describes the JSON stored on SeerAgentRun.


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
    project_ids: list[str]
    results: list[MonitorCleanupOutput]


# Workflow API responses: datetimes are rendered as ISO strings by DRF.


class MonitorCleanupRunResponse(TypedDict):
    id: str
    dateAdded: datetime
    dateCompleted: datetime | None
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
