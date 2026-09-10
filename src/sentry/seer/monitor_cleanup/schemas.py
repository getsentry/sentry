from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

from pydantic import BaseModel, Field

RESPONSE_VERSION = 1


class MatchingMonitorSetting(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    value: str = Field(..., min_length=1, max_length=200)


class DuplicateMonitorGroup(BaseModel):
    suggested_keep_id: str = Field(..., regex=r"^[0-9]+$")
    duplicate_ids: list[str] = Field(..., min_items=1, max_items=50)
    reason: str = Field(..., min_length=1, max_length=2000)
    differences: list[str] = Field(default_factory=list, max_items=20)
    matching_settings: list[MatchingMonitorSetting] = Field(default_factory=list, max_items=12)


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
    differences: list[str] = Field(default_factory=list, max_items=20)
    matching_settings: list[MatchingMonitorSetting] = Field(default_factory=list, max_items=12)
    comparison: list[MonitorPropertyComparison] = Field(default_factory=list, max_items=12)
    example: str = Field(default="", max_length=1000)
    next_step: str = Field(default="", max_length=500)


class MonitorCleanupArtifact(BaseModel):
    scan_status: Literal["complete", "partial"]
    monitors_scanned: int = Field(..., ge=0)
    summary: str = Field(..., max_length=2000)
    groups: list[DuplicateMonitorGroup] = Field(default_factory=list, max_items=50)
    findings: list[MonitorFinding] | None = None


class ProjectMonitorCleanupArtifact(MonitorCleanupArtifact):
    project_id: str
    findings: list[MonitorFinding] = Field(...)


class OrganizationMonitorCleanupArtifact(BaseModel):
    scan_status: Literal["complete", "partial"]
    projects: list[ProjectMonitorCleanupArtifact]


class MonitorCleanupResponseV1(BaseModel):
    schema_version: Literal[1]
    data: OrganizationMonitorCleanupArtifact


class MonitorCleanupOutputBase(TypedDict):
    outputKind: Literal["monitor_cleanup"]
    projectId: str
    projectSlug: NotRequired[str]
    scan: MonitorCleanupScan
    summary: str


class MonitorCleanupOutputV1(MonitorCleanupOutputBase):
    schemaVersion: Literal[1]
    groups: list[MonitorCleanupGroup]


class MonitorCleanupOutputV2(MonitorCleanupOutputBase):
    schemaVersion: Literal[2]
    findings: list[MonitorCleanupFinding]


type MonitorCleanupOutput = MonitorCleanupOutputV1 | MonitorCleanupOutputV2


class MonitorCleanupScan(TypedDict):
    status: Literal["complete", "partial"]
    monitorsScanned: int


class MonitorCleanupGroup(TypedDict):
    keep: MonitorCleanupReference
    duplicates: list[MonitorCleanupReference]
    reason: str
    differences: list[str]
    matchingSettings: list[MonitorCleanupSetting]


class MonitorCleanupFinding(TypedDict):
    kind: Literal["exact_duplicate", "overlapping_coverage", "duplicate_notifications"]
    monitors: list[MonitorCleanupResource]
    suggestedKeepId: str | None
    alerts: list[MonitorCleanupResource]
    reason: str
    differences: list[str]
    matchingSettings: list[MonitorCleanupSetting]
    comparison: list[MonitorCleanupComparison]
    example: str
    nextStep: str


class MonitorCleanupReference(TypedDict):
    id: str
    name: str


class MonitorCleanupResource(MonitorCleanupReference):
    enabled: bool


class MonitorCleanupSetting(TypedDict):
    label: str
    value: str


class MonitorCleanupComparison(TypedDict):
    property: str
    values: list[MonitorCleanupComparisonValue]


class MonitorCleanupComparisonValue(TypedDict):
    monitorId: str
    value: str
