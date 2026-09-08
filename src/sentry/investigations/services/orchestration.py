from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import IntegrityError, router, transaction
from django.db.models import Max
from django.utils import timezone

from sentry.investigations.models import (
    Investigation,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.services.breached_metrics import BreachedMetricSource
from sentry.investigations.services.investigations import (
    DEFAULT_INVESTIGATION_TITLE,
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
    _create_project_links,
    _legacy_storage_filters,
    investigation_lineage_key,
)
from sentry.models.organization import Organization


@dataclass(frozen=True)
class AcceptedOrchestrationCommand:
    run_id: int | None
    request_id: UUID
    duplicate: bool
    workflow_version: int
    projection: dict[str, Any]


__all__ = [
    "AcceptedOrchestrationCommand",
    "accept_orchestration_command",
    "agentic_breached_metric_lineage_key",
    "create_agentic_breached_metric_investigation",
    "create_agentic_manual_investigation",
    "get_orchestration_projection",
]


def _initial_projection(
    *, investigation_id: int, source: dict[str, Any]
) -> tuple[str, str, dict[str, Any]]:
    source_type = source["type"]
    missing_fields: list[str] = []
    if source_type == "manual":
        prompt = source.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            missing_fields.append("prompt")

    awaiting_input = bool(missing_fields)
    phase = "intake" if awaiting_input else "broad_scan"
    status = (
        InvestigationOrchestrationStatus.AWAITING_INPUT
        if awaiting_input
        else InvestigationOrchestrationStatus.PENDING
    )
    return (
        phase,
        status,
        {
            "runId": None,
            "investigationId": str(investigation_id),
            "sourceType": source_type,
            "workflowVersion": 1,
            "generation": 1,
            "phase": phase,
            "status": status,
            "broadScan": {
                "status": "blocked" if awaiting_input else "queued",
                "summary": None,
                "error": None,
            },
            "hypotheses": [],
            "report": {
                "revision": 0,
                "status": "not_started",
                "includedHypothesisIds": [],
                "primaryHypothesisId": None,
                "currentBlockKey": None,
                "notebookRevision": 0,
                "metadata": {
                    "status": "not_started",
                    "title": None,
                    "summary": None,
                    "summaryDescription": None,
                    "error": None,
                },
                "error": None,
            },
            "pendingInput": (
                {
                    "missingFields": missing_fields,
                    "prompt": "Provide the missing investigation context to begin the broad scan.",
                }
                if awaiting_input
                else None
            ),
            "errors": [],
            "heartbeatAt": None,
        },
    )


def _create_agentic_investigation(
    *,
    organization: Organization,
    user_id: int,
    title: str | None,
    source: dict[str, Any],
    orchestration_source: dict[str, Any],
    project_ids: list[int],
    filters: dict[str, Any],
    source_type: str = InvestigationSourceType.MANUAL,
    source_ref: dict[str, Any] | None = None,
    source_key: str | None = None,
    lineage_key: str | None = None,
    source_revision: int | None = None,
) -> tuple[Investigation, InvestigationOrchestrationRun]:
    """Create the notebook and its parent control-plane aggregate atomically."""

    with transaction.atomic(using=router.db_for_write(Investigation)):
        investigation = Investigation.objects.create(
            organization=organization,
            created_by_id=user_id,
            title=title or DEFAULT_INVESTIGATION_TITLE,
            source_type=source_type,
            source_ref=deepcopy(source_ref or {}),
            source_key=source_key,
            source=deepcopy(source),
            lineage_key=lineage_key,
            source_revision=source_revision,
            filters=deepcopy(filters),
        )
        _create_project_links(investigation, project_ids)
        phase, status, projection = _initial_projection(
            investigation_id=investigation.id, source=orchestration_source
        )
        orchestration_run = InvestigationOrchestrationRun.objects.create(
            investigation=investigation,
            phase=phase,
            status=status,
            source=deepcopy(orchestration_source),
            projection=projection,
        )
    return investigation, orchestration_run


def _manual_orchestration_source(source: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {
        "type": "manual",
        "projectScope": {"type": "investigation"},
        "seed": deepcopy(source.get("seed", {})),
    }
    for key in ("prompt", "timeRange"):
        if key in source:
            normalized[key] = deepcopy(source[key])
    return normalized


def create_agentic_manual_investigation(
    *,
    organization: Organization,
    user_id: int,
    title: str | None,
    source: dict[str, Any],
    project_ids: list[int],
    filters: dict[str, Any],
) -> tuple[Investigation, InvestigationOrchestrationRun]:
    return _create_agentic_investigation(
        organization=organization,
        user_id=user_id,
        title=title,
        source=source,
        orchestration_source=_manual_orchestration_source(source),
        project_ids=project_ids,
        filters=filters,
    )


def _breached_metric_orchestration_source(source: dict[str, Any]) -> dict[str, Any]:
    """Build internal orchestration context from Sentry's canonical metric snapshot."""

    snapshot = source["snapshot"]
    monitor = snapshot["monitor"]
    project = snapshot["project"]
    window = snapshot["analysisWindow"]
    conditions = monitor["conditions"]
    threshold = next(
        (
            condition.get("comparison")
            for condition in conditions
            if isinstance(condition, dict)
            and isinstance(condition.get("comparison"), int | float)
            and not isinstance(condition.get("comparison"), bool)
        ),
        None,
    )
    project_id = int(project["id"])
    breach_start = window["breachStart"]
    baseline_start = window["baselineStart"]
    end = window["end"]
    return {
        "type": "breached_metric",
        "metricIssueId": snapshot["groupId"],
        "openPeriodId": snapshot["openPeriodId"],
        "detectorId": monitor["id"],
        "monitorId": monitor["id"],
        "monitorName": monitor["name"],
        "metricQuery": monitor["query"],
        "projectIds": [project_id],
        "monitor": deepcopy(monitor),
        "project": deepcopy(project),
        "analysisWindow": deepcopy(window),
        "environment": monitor["environment"],
        "threshold": threshold,
        "thresholdDirection": monitor["direction"],
        "openPeriod": {"start": breach_start, "end": end},
        "baselinePeriod": {"start": baseline_start, "end": breach_start},
        "seed": {
            "groupTitle": snapshot["groupTitle"],
            "sentrySource": deepcopy(source),
        },
    }


def agentic_breached_metric_lineage_key(source: dict[str, Any]) -> str:
    return investigation_lineage_key("agentic_breached_metric", source)


def create_agentic_breached_metric_investigation(
    *,
    organization: Organization,
    user_id: int,
    title: str | None,
    resolved_source: BreachedMetricSource,
    project_ids: list[int],
    filters: dict[str, Any],
) -> tuple[Investigation, bool]:
    normalized_source = resolved_source.source
    lineage_key = agentic_breached_metric_lineage_key(normalized_source)
    # Uniqueness on active lineage and revision arbitrates concurrent launches.
    for attempt in range(3):
        active = (
            Investigation.objects.filter(
                organization=organization,
                lineage_key=lineage_key,
                status=InvestigationStatus.ACTIVE,
            )
            .order_by("-source_revision", "-id")
            .first()
        )
        if active is not None:
            return active, False
        latest_revision = Investigation.objects.filter(
            organization=organization,
            lineage_key=lineage_key,
        ).aggregate(latest=Max("source_revision"))["latest"]
        try:
            investigation, _ = _create_agentic_investigation(
                organization=organization,
                user_id=user_id,
                title=title,
                source=normalized_source,
                orchestration_source=_breached_metric_orchestration_source(normalized_source),
                project_ids=project_ids,
                filters=_legacy_storage_filters(normalized_source, filters),
                source_type=InvestigationSourceType.METRIC_OPEN_PERIOD,
                source_ref=normalized_source["ref"],
                source_key=lineage_key,
                lineage_key=lineage_key,
                source_revision=(latest_revision or 0) + 1,
            )
            return investigation, True
        except IntegrityError:
            if attempt == 2:
                active = Investigation.objects.filter(
                    organization=organization,
                    lineage_key=lineage_key,
                    status=InvestigationStatus.ACTIVE,
                ).first()
                if active is not None:
                    return active, False
                raise
    raise AssertionError("unreachable")


def _serialize_orchestration_run(run: InvestigationOrchestrationRun) -> dict[str, Any]:
    """Overlay projection JSON with the run's authoritative scalar fields."""

    projection = deepcopy(run.projection)
    projection.update(
        {
            "runId": (
                str(run.seer_run.seer_run_state_id)
                if run.seer_run is not None and run.seer_run.seer_run_state_id is not None
                else None
            ),
            "investigationId": str(run.investigation_id),
            "workflowVersion": run.workflow_version,
            "generation": run.generation,
            "phase": run.phase,
            "status": run.status,
            "notebookRevision": run.notebook_revision,
            "heartbeatAt": run.heartbeat_at,
            "updatedAt": run.date_updated,
        }
    )
    projection["report"]["notebookRevision"] = run.notebook_revision
    return projection


def get_orchestration_projection(investigation: Investigation) -> dict[str, Any]:
    try:
        run = InvestigationOrchestrationRun.objects.select_related("seer_run").get(
            investigation=investigation
        )
    except InvestigationOrchestrationRun.DoesNotExist:
        raise InvestigationSourceNotFound
    return _serialize_orchestration_run(run)


def _command_acceptance(
    run: InvestigationOrchestrationRun,
    command: InvestigationOrchestrationCommand,
    *,
    duplicate: bool,
) -> AcceptedOrchestrationCommand:
    return AcceptedOrchestrationCommand(
        run_id=(
            run.seer_run.seer_run_state_id
            if run.seer_run is not None and run.seer_run.seer_run_state_id is not None
            else None
        ),
        request_id=command.request_id,
        duplicate=duplicate,
        workflow_version=run.workflow_version,
        projection=_serialize_orchestration_run(run),
    )


def accept_orchestration_command(
    *,
    investigation: Investigation,
    request_id: UUID,
    expected_workflow_version: int,
    command_type: str,
    payload: dict[str, Any],
    actor_id: int,
) -> AcceptedOrchestrationCommand:
    with transaction.atomic(using=router.db_for_write(InvestigationOrchestrationRun)):
        try:
            locked_investigation = Investigation.objects.select_for_update().get(
                id=investigation.id
            )
        except Investigation.DoesNotExist:
            raise InvestigationSourceNotFound
        if locked_investigation.status == InvestigationStatus.ARCHIVED:
            raise InvestigationValidationError(
                {"detail": "Archived investigations do not accept commands."}
            )
        try:
            run = InvestigationOrchestrationRun.objects.select_for_update().get(
                investigation=locked_investigation
            )
        except InvestigationOrchestrationRun.DoesNotExist:
            raise InvestigationSourceNotFound

        existing = InvestigationOrchestrationCommand.objects.filter(
            orchestration_run=run, request_id=request_id
        ).first()
        if existing is not None:
            if (
                existing.expected_workflow_version != expected_workflow_version
                or existing.type != command_type
                or existing.payload != payload
            ):
                raise InvestigationConflictError(
                    "Request ID was already used for a different command."
                )
            return _command_acceptance(run, existing, duplicate=True)

        if run.workflow_version != expected_workflow_version:
            raise InvestigationConflictError("Workflow version does not match.")

        resulting_version = run.workflow_version + 1
        command = InvestigationOrchestrationCommand.objects.create(
            orchestration_run=run,
            request_id=request_id,
            actor_id=actor_id,
            expected_workflow_version=expected_workflow_version,
            resulting_workflow_version=resulting_version,
            type=command_type,
            payload=deepcopy(payload),
        )
        projection = deepcopy(run.projection)
        projection["workflowVersion"] = resulting_version
        run.workflow_version = resulting_version
        run.projection = projection
        run.date_updated = timezone.now()
        run.save(update_fields=["workflow_version", "projection", "date_updated"])
        return _command_acceptance(run, command, duplicate=False)
