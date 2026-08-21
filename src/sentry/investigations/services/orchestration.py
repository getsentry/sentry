from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db import router, transaction
from django.utils import timezone

from sentry.investigations.models import (
    Investigation,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.investigations.services.investigations import (
    DEFAULT_INVESTIGATION_TITLE,
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
    _create_project_links,
)
from sentry.models.organization import Organization
from sentry.utils import json

MAX_AGENTIC_SOURCE_BYTES = 200_000


@dataclass(frozen=True)
class AcceptedOrchestrationCommand:
    orchestration_run: InvestigationOrchestrationRun
    command: InvestigationOrchestrationCommand
    duplicate: bool


def _initial_projection(
    *, investigation_id: int, source: dict[str, Any]
) -> tuple[str, str, dict[str, Any]]:
    source_type = source["type"]
    missing_fields: list[str] = []
    if source_type == "manual":
        prompt = source.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            missing_fields.append("prompt")
        if source.get("timeRange") is None:
            missing_fields.append("time_range")

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


def create_agentic_investigation(
    *,
    organization: Organization,
    user_id: int,
    title: str | None,
    source: dict[str, Any],
    project_ids: list[int],
    filters: dict[str, Any],
) -> tuple[Investigation, InvestigationOrchestrationRun]:
    """Create the notebook and its parent control-plane aggregate atomically."""

    with transaction.atomic(using=router.db_for_write(Investigation)):
        investigation = Investigation.objects.create(
            organization=organization,
            created_by_id=user_id,
            title=title or DEFAULT_INVESTIGATION_TITLE,
            source=deepcopy(source),
            filters=deepcopy(filters),
        )
        _create_project_links(investigation, project_ids)
        phase, status, projection = _initial_projection(
            investigation_id=investigation.id, source=source
        )
        orchestration_run = InvestigationOrchestrationRun.objects.create(
            investigation=investigation,
            phase=phase,
            status=status,
            source=deepcopy(source),
            projection=projection,
        )
    return investigation, orchestration_run


def serialize_orchestration_run(run: InvestigationOrchestrationRun) -> dict[str, Any]:
    projection = deepcopy(run.projection)
    projection.update(
        {
            "runId": str(run.seer_run_id) if run.seer_run_id is not None else None,
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
    report = projection.setdefault("report", {})
    if isinstance(report, dict):
        report["notebookRevision"] = run.notebook_revision
    return projection


def get_orchestration_run(investigation: Investigation) -> InvestigationOrchestrationRun:
    try:
        return InvestigationOrchestrationRun.objects.get(investigation=investigation)
    except InvestigationOrchestrationRun.DoesNotExist:
        raise InvestigationSourceNotFound


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
            run = InvestigationOrchestrationRun.objects.select_for_update().get(
                investigation=investigation
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
            return AcceptedOrchestrationCommand(run, existing, duplicate=True)

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
        return AcceptedOrchestrationCommand(run, command, duplicate=False)


def validate_agentic_source(source: Any) -> dict[str, Any]:
    """Validate the stable envelope while allowing additive source seed fields."""

    if not isinstance(source, dict):
        raise InvestigationValidationError({"source": "Must be an object."})
    if len(json.dumps(source).encode()) > MAX_AGENTIC_SOURCE_BYTES:
        raise InvestigationValidationError({"source": "Investigation context is too large."})
    source_type = source.get("type")
    if source_type not in {"manual", "breached_metric"}:
        raise InvestigationValidationError(
            {"source": "Agentic source type must be manual or breached_metric."}
        )
    seed = source.get("seed", {})
    if not isinstance(seed, dict):
        raise InvestigationValidationError({"source": "seed must be an object."})
    if source_type == "manual":
        prompt = source.get("prompt")
        if prompt is not None and (not isinstance(prompt, str) or len(prompt) > 20_000):
            raise InvestigationValidationError(
                {"source": "prompt must be a string no longer than 20,000 characters."}
            )
        time_range = source.get("timeRange")
        if time_range is not None and not isinstance(time_range, dict):
            raise InvestigationValidationError({"source": "timeRange must be an object."})
    else:
        project_ids = source.get("projectIds", [])
        if (
            not isinstance(project_ids, list)
            or len(project_ids) > 100
            or any(
                isinstance(project_id, bool) or not isinstance(project_id, int)
                for project_id in project_ids
            )
        ):
            raise InvestigationValidationError({"source": "projectIds must contain IDs."})
    return source
