from collections.abc import Mapping

from sentry.auth import access
from sentry.incidents.grouptype import MetricIssue
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.monitor_cleanup.schemas import (
    MonitorCleanupArtifact,
    MonitorCleanupComparison,
    MonitorCleanupComparisonValue,
    MonitorCleanupFinding,
    MonitorCleanupOutput,
    MonitorCleanupResource,
    MonitorFinding,
    OrganizationMonitorCleanupArtifact,
)
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import Detector, DetectorWorkflow, Workflow


def parse_monitor_cleanup_results(
    artifact: OrganizationMonitorCleanupArtifact, organization: Organization, user_id: int
) -> list[MonitorCleanupOutput]:
    """Parse Seer findings into stored results, resolving resource IDs with read-only lookups."""
    project_ids = [project.project_id for project in artifact.projects]
    projects = {
        project.id: project
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
    outputs: list[MonitorCleanupOutput] = []
    for project_artifact in artifact.projects:
        project = projects[project_artifact.project_id]
        output = parse_project_monitor_cleanup_result(project_artifact, organization.id, project.id)
        output["projectSlug"] = project.slug
        outputs.append(output)
    return outputs


def parse_project_monitor_cleanup_result(
    artifact: MonitorCleanupArtifact, organization_id: int, project_id: int
) -> MonitorCleanupOutput:
    findings = artifact.findings
    ids = {monitor_id for finding in findings for monitor_id in finding.monitor_ids}
    alert_ids = {alert_id for finding in findings for alert_id in finding.alert_ids}
    monitors: dict[int, MonitorCleanupResource] = {
        detector.id: _serialize_resource(detector)
        for detector in Detector.objects.filter(
            id__in=ids,
            project_id=project_id,
            project__organization_id=organization_id,
            type=MetricIssue.slug,
        )
    }
    alerts: dict[int, MonitorCleanupResource] = {
        link.workflow_id: _serialize_resource(link.workflow)
        for link in DetectorWorkflow.objects.filter(
            detector_id__in=monitors,
            workflow_id__in=alert_ids,
            workflow__organization_id=organization_id,
        ).select_related("workflow")
    }
    return {
        "outputKind": "monitor_cleanup",
        "schemaVersion": 1,
        "projectId": str(project_id),
        "scan": {"status": artifact.scan_status, "monitorsScanned": artifact.monitors_scanned},
        "summary": artifact.summary,
        "findings": [_serialize_finding(finding, monitors, alerts) for finding in findings],
    }


def _serialize_resource(resource: Detector | Workflow) -> MonitorCleanupResource:
    return {"id": str(resource.id), "name": resource.name, "enabled": resource.enabled}


def _serialize_finding(
    finding: MonitorFinding,
    monitors: Mapping[int, MonitorCleanupResource],
    alerts: Mapping[int, MonitorCleanupResource],
) -> MonitorCleanupFinding:
    comparisons: list[MonitorCleanupComparison] = []
    for row in finding.comparison:
        values: list[MonitorCleanupComparisonValue] = [
            {"monitorId": str(value.monitor_id), "value": value.value} for value in row.values
        ]
        comparisons.append({"property": row.property, "values": values})

    return {
        "kind": finding.kind,
        "monitors": [monitors[monitor_id] for monitor_id in finding.monitor_ids],
        "suggestedKeepId": str(finding.suggested_keep_id)
        if finding.suggested_keep_id is not None
        else None,
        "alerts": [alerts[alert_id] for alert_id in dict.fromkeys(finding.alert_ids)],
        "reason": finding.reason,
        "comparison": comparisons,
    }
