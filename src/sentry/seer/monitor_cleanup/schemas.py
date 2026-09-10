from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

from pydantic import BaseModel, Field

RESPONSE_VERSION = 1


class MonitorPropertyValue(BaseModel):
    monitor_id: str
    value: str = Field(..., min_length=1, max_length=160)


class MonitorPropertyComparison(BaseModel):
    property: str = Field(..., min_length=1, max_length=60)
    values: list[MonitorPropertyValue] = Field(..., min_items=2, max_items=50)


class MonitorFinding(BaseModel):
    kind: Literal["exact_duplicate", "overlapping_coverage", "duplicate_notifications"]
    monitor_ids: list[str] = Field(..., min_items=2, max_items=50)
    suggested_keep_id: str | None = None
    alert_ids: list[str] = Field(default_factory=list, max_items=50)
    reason: str = Field(..., min_length=1, max_length=2000)
    comparison: list[MonitorPropertyComparison] = Field(default_factory=list, max_items=12)


class MonitorCleanupArtifact(BaseModel):
    scan_status: Literal["complete", "partial"]
    monitors_scanned: int = Field(..., ge=0)
    summary: str = Field(..., max_length=2000)
    findings: list[MonitorFinding] = Field(..., max_items=50)


class ProjectMonitorCleanupArtifact(MonitorCleanupArtifact):
    project_id: str


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
