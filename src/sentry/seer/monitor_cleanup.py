from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Literal
from uuid import UUID

from django.db import router, transaction
from django.utils import timezone
from pydantic import BaseModel, Field
from rest_framework.exceptions import NotFound, PermissionDenied, Throttled, ValidationError
from rest_framework.request import Request

from sentry import features
from sentry.auth import access
from sentry.incidents.grouptype import MetricIssue
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.users.services.user.service import user_service
from sentry.utils.numbers import validate_bigint
from sentry.workflow_engine.models import Detector, DetectorWorkflow

FEATURE = "organizations:seer-workflows-monitor-cleanup"
FEATURE_ID = "monitor_cleanup"
RESPONSE_VERSION = 1
logger = logging.getLogger(__name__)
TERMINAL = {"complete", "partial", "failed"}


def create_monitor_cleanup_run(request: Request, organization: Organization) -> SeerNightShiftRun:
    # Tasks import the workflow definition, so import dispatch after module initialization.
    from sentry.tasks.seer.monitor_cleanup import dispatch_run

    if not features.has(FEATURE, organization, actor=request.user):
        raise NotFound
    if not request.user.is_authenticated:
        raise PermissionDenied("Sign in to run a monitor scan.")
    config = SeerWorkflowConfig.get_or_create_for_strategy(
        organization.id, SeerWorkflowStrategy.DUPLICATE_MONITORS
    )
    with transaction.atomic(router.db_for_write(SeerNightShiftRun)):
        config = SeerWorkflowConfig.objects.select_for_update().get(id=config.id)
        if SeerNightShiftRun.objects.filter(
            workflow_config=config, date_completed__isnull=True
        ).exists():
            raise ValidationError({"detail": "A monitor scan is already running."})
        if (
            SeerNightShiftRun.objects.filter(
                workflow_config=config, date_added__gte=timezone.now() - timedelta(hours=1)
            ).count()
            >= 5
        ):
            raise Throttled(
                detail="This organization has reached the limit of five scans per hour."
            )
        run = SeerNightShiftRun.objects.create(
            organization=organization,
            workflow_config=config,
            extras={
                "options": {"source": "manual"},
                "triggering_user_id": request.user.id,
                "status": "running",
                "response_schema_version": RESPONSE_VERSION,
            },
        )
        SeerNightShiftRunShard.objects.create(run=run, extras={"status": "queued"})
        transaction.on_commit(
            lambda: dispatch_run(run.id), using=router.db_for_write(SeerNightShiftRun)
        )
    return run


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


def prepare_monitor_cleanup_results(
    artifact: OrganizationMonitorCleanupArtifact, organization: Organization, user_id: int
) -> list[dict[str, object]]:
    project_ids = [project.project_id for project in artifact.projects]
    if any(
        not value.isdecimal() or len(value) > 19 or not validate_bigint(int(value))
        for value in project_ids
    ) or len(project_ids) != len(set(project_ids)):
        raise ValueError("The scan returned invalid project IDs.")
    projects = {
        str(project.id): project
        for project in Project.objects.filter(organization=organization, id__in=project_ids)
    }
    user = user_service.get_user(user_id=user_id)
    if user is None:
        raise ValueError("The triggering user no longer exists.")
    user_access = access.from_user(user, organization)
    if projects.keys() != set(project_ids) or not user_access.has_projects_access(
        projects.values()
    ):
        raise ValueError("Some scanned projects are no longer accessible.")
    outputs = []
    for project_artifact in artifact.projects:
        project = projects[project_artifact.project_id]
        output = validate_monitor_cleanup(project_artifact, organization.id, project.id)
        output["projectSlug"] = project.slug
        outputs.append(output)
    return outputs


def validate_monitor_cleanup(
    artifact: MonitorCleanupArtifact, organization_id: int, project_id: int
) -> dict[str, object]:
    if artifact.findings is not None:
        return validate_monitor_findings(artifact, organization_id, project_id)
    ids = [
        detector_id
        for group in artifact.groups
        for detector_id in [group.suggested_keep_id, *group.duplicate_ids]
    ]
    if any(
        not value.isdecimal() or len(value) > 19 or not validate_bigint(int(value)) for value in ids
    ):
        raise ValueError("The scan returned an invalid monitor ID.")
    if len(ids) != len(set(ids)):
        raise ValueError("The scan returned overlapping monitor groups.")
    monitors = {
        str(detector.id): {"id": str(detector.id), "name": detector.name}
        for detector in Detector.objects.filter(
            id__in=ids,
            project_id=project_id,
            project__organization_id=organization_id,
            type=MetricIssue.slug,
        )
    }
    if set(ids) != monitors.keys():
        raise ValueError("Some suggested monitors no longer exist or are outside this project.")
    return {
        "outputKind": "monitor_cleanup",
        "schemaVersion": 1,
        "projectId": str(project_id),
        "scan": {"status": artifact.scan_status, "monitorsScanned": artifact.monitors_scanned},
        "summary": artifact.summary,
        "groups": [
            {
                "keep": monitors[group.suggested_keep_id],
                "duplicates": [monitors[detector_id] for detector_id in group.duplicate_ids],
                "reason": group.reason,
                "differences": group.differences,
                "matchingSettings": [setting.dict() for setting in group.matching_settings],
            }
            for group in artifact.groups
        ],
    }


def validate_monitor_findings(
    artifact: MonitorCleanupArtifact, organization_id: int, project_id: int
) -> dict[str, object]:
    findings = artifact.findings or []
    if artifact.groups or len(findings) > 50:
        raise ValueError("The scan returned an invalid finding list.")
    ids = {monitor_id for finding in findings for monitor_id in finding.monitor_ids}
    alert_ids = {alert_id for finding in findings for alert_id in finding.alert_ids}
    if any(
        not value.isdecimal() or len(value) > 19 or not validate_bigint(int(value))
        for value in ids | alert_ids
    ):
        raise ValueError("The scan returned an invalid monitor or alert ID.")
    monitors = {
        str(detector.id): {
            "id": str(detector.id),
            "name": detector.name,
            "enabled": detector.enabled,
        }
        for detector in Detector.objects.filter(
            id__in=ids,
            project_id=project_id,
            project__organization_id=organization_id,
            type=MetricIssue.slug,
        )
    }
    if ids != monitors.keys():
        raise ValueError("Some suggested monitors no longer exist or are outside this project.")
    links = list(
        DetectorWorkflow.objects.filter(
            detector_id__in=ids,
            workflow_id__in=alert_ids,
            workflow__organization_id=organization_id,
        ).select_related("workflow")
    )
    alerts = {
        str(link.workflow_id): {
            "id": str(link.workflow_id),
            "name": link.workflow.name,
            "enabled": link.workflow.enabled,
        }
        for link in links
    }
    seen = set()
    exact_ids: set[str] = set()
    for finding in findings:
        members = set(finding.monitor_ids)
        for row in finding.comparison:
            row_ids = {value.monitor_id for value in row.values}
            if len(row_ids) != len(row.values) or row_ids != members:
                raise ValueError("Comparison rows must contain each finding monitor exactly once.")
        key = (finding.kind, tuple(sorted(members)))
        if len(members) != len(finding.monitor_ids) or key in seen:
            raise ValueError("The scan returned overlapping monitor groups.")
        seen.add(key)
        if finding.kind == "exact_duplicate":
            if finding.suggested_keep_id not in members or members & exact_ids:
                raise ValueError("Exact duplicates require a distinct suggested keeper.")
            exact_ids.update(members)
        elif finding.suggested_keep_id is not None:
            raise ValueError("Overlapping coverage and notifications must not recommend deletion.")
        if finding.kind == "duplicate_notifications":
            selected_alerts = set(finding.alert_ids)
            selected_links = {
                (str(link.detector_id), str(link.workflow_id))
                for link in links
                if str(link.detector_id) in members and str(link.workflow_id) in selected_alerts
            }
            if (
                not selected_alerts
                or {monitor_id for monitor_id, _ in selected_links} != members
                or {alert_id for _, alert_id in selected_links} != selected_alerts
            ):
                raise ValueError(
                    "Notification findings require alerts connected to these monitors."
                )
        elif finding.alert_ids:
            raise ValueError("Alert references belong to notification findings.")
    return {
        "outputKind": "monitor_cleanup",
        "schemaVersion": 2,
        "projectId": str(project_id),
        "scan": {"status": artifact.scan_status, "monitorsScanned": artifact.monitors_scanned},
        "summary": artifact.summary,
        "findings": [
            {
                "kind": finding.kind,
                "monitors": [monitors[monitor_id] for monitor_id in finding.monitor_ids],
                "suggestedKeepId": finding.suggested_keep_id,
                "alerts": [alerts[alert_id] for alert_id in dict.fromkeys(finding.alert_ids)],
                "reason": finding.reason,
                "differences": finding.differences,
                "matchingSettings": [setting.dict() for setting in finding.matching_settings],
                "comparison": [
                    {
                        "property": row.property,
                        "values": [
                            {"monitorId": value.monitor_id, "value": value.value}
                            for value in row.values
                        ],
                    }
                    for row in finding.comparison
                ],
                "example": finding.example,
                "nextStep": finding.next_step,
            }
            for finding in findings
        ],
    }


def finish_shard(
    shard_id: int,
    *,
    outputs: list[dict[str, object]] | None = None,
    scan_status: str = "complete",
    error: str | None = None,
) -> None:
    shard = SeerNightShiftRunShard.objects.filter(id=shard_id).first()
    if shard is None:
        return
    with transaction.atomic(router.db_for_write(SeerNightShiftRun)):
        run = SeerNightShiftRun.objects.select_for_update().filter(id=shard.run_id).first()
        if run is None:
            return
        shard = (
            SeerNightShiftRunShard.objects.select_related("seer_run").filter(id=shard_id).first()
        )
        if shard is None or shard.extras.get("status") in TERMINAL:
            return
        for output in outputs or []:
            SeerNightShiftRunResult.objects.get_or_create(
                run=run,
                kind=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                idempotency_key=f"project:{output['projectId']}",
                defaults={"result_seer_run": shard.seer_run, "extras": output},
            )
        status = "failed" if error else scan_status
        shard.update(extras={**shard.extras, "status": status, "error": error})
        run.update(
            extras={**run.extras, "status": status},
            date_completed=timezone.now(),
        )


def deliver_monitor_cleanup_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    shard = (
        SeerNightShiftRunShard.objects.select_related("run__organization", "seer_run")
        .filter(
            run__organization_id=organization_id,
            run__workflow_config__strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS,
            seer_run__uuid=run_uuid,
        )
        .first()
    )
    if shard is None or shard.extras.get("status") in TERMINAL:
        return
    if status != "completed" or result is None:
        finish_shard(shard.id, error="Seer could not complete this scan.")
        return
    # Reject unknown envelopes before interpreting their contents as the current schema.
    if (
        type(result.get("schema_version")) is not int
        or result["schema_version"] != RESPONSE_VERSION
    ):
        finish_shard(
            shard.id, error="Seer returned an unsupported monitor cleanup response version."
        )
        return
    try:
        response = MonitorCleanupResponseV1.parse_obj(result)
        outputs = prepare_monitor_cleanup_results(
            response.data, shard.run.organization, shard.run.extras["triggering_user_id"]
        )
    except ValueError:
        logger.exception("monitor_cleanup.invalid_output", extra={"shard_id": shard.id})
        finish_shard(shard.id, error="Seer returned findings that could not be validated.")
        return
    scan_status = response.data.scan_status
    if any(project.scan_status == "partial" for project in response.data.projects):
        scan_status = "partial"
    finish_shard(shard.id, outputs=outputs, scan_status=scan_status)
