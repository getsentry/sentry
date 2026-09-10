from sentry.auth import access
from sentry.incidents.grouptype import MetricIssue
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.models.run import SeerAgentRun
from sentry.seer.monitor_cleanup.schemas import (
    MonitorCleanupArtifact,
    MonitorCleanupOutput,
    MonitorCleanupResource,
    MonitorCleanupRunExtras,
    MonitorCleanupRunResponse,
    OrganizationMonitorCleanupArtifact,
)
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import Detector, DetectorWorkflow


def prepare_monitor_cleanup_results(
    artifact: OrganizationMonitorCleanupArtifact, organization: Organization, user_id: int
) -> list[MonitorCleanupOutput]:
    project_ids = [project.project_id for project in artifact.projects]
    if len(project_ids) != len(set(project_ids)):
        raise ValueError("The scan returned repeated projects.")
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
        output = validate_monitor_cleanup(project_artifact, organization.id, project.id)
        output["projectSlug"] = project.slug
        outputs.append(output)
    return outputs


def validate_monitor_cleanup(
    artifact: MonitorCleanupArtifact, organization_id: int, project_id: int
) -> MonitorCleanupOutput:
    findings = artifact.findings
    ids = {monitor_id for finding in findings for monitor_id in finding.monitor_ids}
    alert_ids = {alert_id for finding in findings for alert_id in finding.alert_ids}
    monitors: dict[int, MonitorCleanupResource] = {
        detector.id: {
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
    alerts: dict[int, MonitorCleanupResource] = {
        link.workflow_id: {
            "id": str(link.workflow_id),
            "name": link.workflow.name,
            "enabled": link.workflow.enabled,
        }
        for link in links
    }
    seen = set()
    exact_ids: set[int] = set()
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
                (link.detector_id, link.workflow_id)
                for link in links
                if link.detector_id in members and link.workflow_id in selected_alerts
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
        "schemaVersion": 1,
        "projectId": str(project_id),
        "scan": {"status": artifact.scan_status, "monitorsScanned": artifact.monitors_scanned},
        "summary": artifact.summary,
        "findings": [
            {
                "kind": finding.kind,
                "monitors": [monitors[monitor_id] for monitor_id in finding.monitor_ids],
                "suggestedKeepId": str(finding.suggested_keep_id)
                if finding.suggested_keep_id is not None
                else None,
                "alerts": [alerts[alert_id] for alert_id in dict.fromkeys(finding.alert_ids)],
                "reason": finding.reason,
                "comparison": [
                    {
                        "property": row.property,
                        "values": [
                            {"monitorId": str(value.monitor_id), "value": value.value}
                            for value in row.values
                        ],
                    }
                    for row in finding.comparison
                ],
            }
            for finding in findings
        ],
    }


def serialize_monitor_cleanup_run(agent_run: SeerAgentRun) -> MonitorCleanupRunResponse:
    extras: MonitorCleanupRunExtras = agent_run.extras
    run_uuid = str(agent_run.run.uuid)
    return {
        "id": run_uuid,
        "dateAdded": agent_run.run.date_added.isoformat(),
        "dateCompleted": extras["date_completed"],
        "strategy": "duplicate_monitors",
        "extras": {"status": extras["status"]},
        "errorMessage": extras["error"],
        "results": [
            {
                "id": f"{run_uuid}:{output['projectId']}",
                "kind": "duplicate_monitors",
                "seerRunId": run_uuid,
                "extras": output,
            }
            for output in extras["results"]
        ],
    }
