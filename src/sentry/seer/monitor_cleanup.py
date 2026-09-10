from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from typing import Literal

from django.db import router, transaction
from django.utils import timezone
from pydantic import BaseModel, Field
from rest_framework.exceptions import NotFound, PermissionDenied, Throttled, ValidationError
from rest_framework.request import Request

from sentry import features
from sentry.incidents.grouptype import MetricIssue
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.on_completion_hook import AgentOnCompletionHook
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunShard
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.utils.numbers import validate_bigint
from sentry.workflow_engine.models import Detector, DetectorWorkflow

FEATURE = "organizations:seer-workflows-monitor-cleanup"
ARTIFACT_KEY = "monitor_cleanup"


def create_monitor_cleanup_run(
    request: Request, organization: Organization, accessible_projects: Sequence[Project]
) -> SeerNightShiftRun:
    # Tasks import the workflow definition, so import dispatch after module initialization.
    from sentry.tasks.seer.monitor_cleanup import dispatch_run

    if not features.has(FEATURE, organization, actor=request.user):
        raise NotFound
    if not request.user.is_authenticated:
        raise PermissionDenied("Sign in to run a monitor scan.")
    projects = list(
        Project.objects.filter(
            organization=organization,
            id__in=[project.id for project in accessible_projects],
            detector__type=MetricIssue.slug,
        )
        .distinct()
        .order_by("id")
    )
    if not projects:
        raise ValidationError({"detail": "No accessible projects have metric monitors."})
    if len(projects) > 20:
        raise ValidationError(
            {"detail": "This demo supports up to 20 projects with metric monitors."}
        )
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
                "target_project_ids": [p.id for p in projects],
                "status": "running",
            },
        )
        SeerNightShiftRunShard.objects.bulk_create(
            [
                SeerNightShiftRunShard(
                    run=run,
                    extras={"project_id": p.id, "project_slug": p.slug, "status": "queued"},
                )
                for p in projects
            ]
        )
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


class MonitorCleanupCompletionHook(AgentOnCompletionHook):
    @classmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        # Tasks import the hook to attach it to the agent request.
        from sentry.tasks.seer.monitor_cleanup import collect_monitor_cleanup_result

        collect_monitor_cleanup_result(organization.id, run_id)


MONITOR_CLEANUP_PROMPT = """Find duplicate monitors, overlapping coverage, and potential duplicate
notifications among user-created metric monitors in the specified
Sentry project. Use code mode to list the project's detectors (type metric_issue), paginate
through all results, and inspect their detection settings and connected automations.
Compare dataset, query, aggregation, environment, evaluation window, detection mode,
trigger/recovery conditions, enabled state, and connected automation IDs. Names alone do
not establish duplication. Prefer matching effective settings and connected automations.
Explain meaningful differences. Do not claim
that deleting a monitor is verified safe. Ignore system-created error/issue-stream monitors,
Cron and uptime monitors. Only include IDs from the specified project.

This is a read-only demo. Do not change, disable, or delete anything or request approval.
Produce the requested structured artifact and a brief human-readable explanation with
links to the candidate monitors. If pagination or inspection cannot be completed, set
scan_status to partial and explain the limitation; do not claim there are no duplicates.
Return findings (an empty list if none), and leave the legacy groups field empty.
Count only inspected metric_issue monitors in monitors_scanned, excluding system detectors.

Classify each finding using exactly one kind:
- exact_duplicate: identical effective detection settings AND equivalent connected alert
  behavior. Include a suggested_keep_id from monitor_ids. Each monitor belongs to at most
  one exact group. Name similarity or a shared destination alone is insufficient.
- overlapping_coverage: related query scopes or thresholds that can fire for the same
  underlying condition but have meaningful differences. Set suggested_keep_id to null.
  Explain the intersection AND coverage unique to either monitor. Broader coverage does
  not make narrower coverage redundant; different thresholds may represent escalation.
- duplicate_notifications: overlapping or identical monitor conditions connected to the
  same alert (workflow), or separate alerts with equivalent notification actions. Inspect
  linked workflows, their trigger/action filters, environment, frequency, enabled state,
  action types, integrations, and destinations. Include verified workflow IDs in alert_ids.
  Explain when both notification paths could apply and any delivery/deduplication uncertainty.
  Sentry deduplicates matching actions within an event's action processing; a shared alert
  does not establish duplicate delivery across separate monitor incidents.
  Sharing a destination without overlapping triggers is insufficient. These are potential
  repeated notifications inferred from configuration, never observed duplicate deliveries.
  Set suggested_keep_id to null. Disabled monitors/alerts can be reported as configuration
  overlap, but explicitly say they cannot currently send these notifications.

The same pair may have a coverage finding AND a notification finding, but never repeat
the same kind for that pair. Use monitor_ids for the distinct members of every finding.
Leave alert_ids empty for coverage/exact findings.

The UI is a compact property comparison table, not a report. For each finding:
- reason: one plain sentence, at most 140 characters, stating the key relationship.
  Do not repeat monitor IDs or names. Example: "Checkout timeouts are a subset of all
  checkout errors, but trigger at a lower threshold."
- comparison: up to 8 relevant property rows with a short label and one value per monitor,
  using monitor_id. Include both matching and differing properties. Start with the
  important differences (query, trigger), then shared properties (window, aggregation,
  environment). For notification findings include alert, destination, and frequency.
  Use consistent wording/units for equal values so the UI can mark differing values.
  Use compact values such as ">100 errors", "5 min", or "All environments"; no sentences.
  Only include properties you inspected; never infer missing values.
- Leave differences, matching_settings, example, and next_step empty. All supporting
  evidence belongs in the comparison table. Do not write hypothetical scenarios or
  multi-paragraph recommendations.
Keep the overall summary to one short sentence. Do not recommend deleting an overlap
solely because it shares a destination or owner.
"""
