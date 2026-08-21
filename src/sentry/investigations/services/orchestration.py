from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from functools import partial
from typing import Any
from uuid import UUID, uuid5

from django.db import IntegrityError, router, transaction
from django.db.models import F, Max
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
    InvestigationStatus,
)
from sentry.investigations.services.breached_metrics import BreachedMetricSource
from sentry.investigations.services.investigations import (
    DEFAULT_INVESTIGATION_TITLE,
    InvestigationConflictError,
    InvestigationSourceNotFound,
    InvestigationValidationError,
    _create_project_links,
    archive_investigation,
    investigation_lineage_key,
    update_investigation,
)
from sentry.models.organization import Organization
from sentry.utils import json

MAX_AGENTIC_SOURCE_BYTES = 200_000
_ARCHIVE_CANCEL_NAMESPACE = UUID("cde61615-4bc3-43a4-a022-1608dc33d512")
_CONTROL_KEY = "_sentryControl"


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
    orchestration_source: dict[str, Any] | None = None,
    project_ids: list[int],
    filters: dict[str, Any],
    lineage_key: str | None = None,
    source_revision: int | None = None,
) -> tuple[Investigation, InvestigationOrchestrationRun]:
    """Create the notebook and its parent control-plane aggregate atomically."""

    with transaction.atomic(using=router.db_for_write(Investigation)):
        investigation = Investigation.objects.create(
            organization=organization,
            created_by_id=user_id,
            title=title or DEFAULT_INVESTIGATION_TITLE,
            source=deepcopy(source),
            filters=deepcopy(filters),
            lineage_key=lineage_key,
            source_revision=source_revision,
        )
        _create_project_links(investigation, project_ids)
        seer_source = orchestration_source or source
        phase, status, projection = _initial_projection(
            investigation_id=investigation.id, source=seer_source
        )
        orchestration_run = InvestigationOrchestrationRun.objects.create(
            investigation=investigation,
            phase=phase,
            status=status,
            source=deepcopy(seer_source),
            projection=projection,
        )
        from sentry.tasks.seer.investigation import dispatch_investigation_orchestration_create

        transaction.on_commit(
            partial(dispatch_investigation_orchestration_create.delay, orchestration_run.id),
            using=router.db_for_write(InvestigationOrchestrationRun),
        )
    return investigation, orchestration_run


def serialize_orchestration_run(run: InvestigationOrchestrationRun) -> dict[str, Any]:
    projection = deepcopy(run.projection)
    projection.pop("_sentryControl", None)
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


def _hypothesis_ids(run: InvestigationOrchestrationRun) -> set[str]:
    hypotheses = run.projection.get("hypotheses")
    if not isinstance(hypotheses, list):
        return set()
    return {
        hypothesis["id"]
        for hypothesis in hypotheses
        if isinstance(hypothesis, dict) and isinstance(hypothesis.get("id"), str)
    }


def _validate_command_target(
    run: InvestigationOrchestrationRun,
    *,
    command_type: str,
    payload: dict[str, Any],
) -> None:
    targets_hypothesis = False
    hypothesis_id: Any = None
    if command_type == "set_hypothesis_disposition":
        targets_hypothesis = True
        hypothesis_id = payload.get("hypothesis_id")
    elif command_type in {"steer", "retry"} and payload.get("target") == "hypothesis":
        targets_hypothesis = True
        hypothesis_id = payload.get("target_id")
    if not targets_hypothesis:
        return
    if not isinstance(hypothesis_id, str) or hypothesis_id not in _hypothesis_ids(run):
        raise InvestigationValidationError({"detail": "Hypothesis was not found."})


def _command_invalidates_notebook(command_type: str, payload: dict[str, Any]) -> bool:
    return (
        command_type in {"add_hypothesis", "set_hypothesis_disposition"}
        or command_type == "steer"
        and payload.get("target") in {"workflow", "hypothesis"}
        or command_type == "retry"
        and payload.get("target") in {"hypothesis", "report"}
    )


def _cancel_active_notebook_executions(run: InvestigationOrchestrationRun) -> None:
    now = timezone.now()
    InvestigationBlockExecution.objects.filter(
        block__investigation=run.investigation,
        status__in=(
            InvestigationBlockExecutionStatus.PENDING,
            InvestigationBlockExecutionStatus.RUNNING,
            InvestigationBlockExecutionStatus.AWAITING_INPUT,
            InvestigationBlockExecutionStatus.STOPPING,
        ),
    ).update(
        status=InvestigationBlockExecutionStatus.CANCELLED,
        error={
            "code": "investigation_report_restarted",
            "message": "The investigation report was restarted.",
        },
        completed_at=now,
        date_updated=now,
    )


def _current_report_revision(projection: dict[str, Any]) -> int:
    control = projection.get(_CONTROL_KEY)
    control_revision = control.get("reportRevision") if isinstance(control, dict) else None
    report = projection.get("report")
    projected_revision = report.get("revision") if isinstance(report, dict) else None
    revisions = [
        value
        for value in (control_revision, projected_revision)
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0
    ]
    return max(revisions, default=0)


def _invalidate_notebook(run: InvestigationOrchestrationRun) -> None:
    now = timezone.now()
    _cancel_active_notebook_executions(run)
    InvestigationBlock.objects.filter(
        investigation=run.investigation,
        deleted_at__isnull=True,
    ).update(deleted_at=now, date_updated=now)
    Investigation.objects.filter(id=run.investigation_id).update(
        version=F("version") + 1,
        date_updated=now,
    )
    run.notebook_revision += 1
    projection = deepcopy(run.projection)
    report = projection.setdefault("report", {})
    if isinstance(report, dict):
        report.update(
            {
                "status": "not_started",
                "currentBlockKey": None,
                "notebookRevision": run.notebook_revision,
                "error": None,
            }
        )
    control = projection.setdefault("_sentryControl", {})
    if isinstance(control, dict):
        control["clearAwaitingSeer"] = True
        control["clearAwaitingSeerThroughRevision"] = _current_report_revision(projection)
    run.projection = projection


def _clear_command_dispatch_error(
    run: InvestigationOrchestrationRun,
    *,
    request_id: UUID,
) -> None:
    projection = deepcopy(run.projection)
    errors = projection.get("errors")
    if isinstance(errors, list):
        projection["errors"] = [
            error
            for error in errors
            if not (
                isinstance(error, dict)
                and error.get("code") == "seer_command_dispatch_failed"
                and error.get("requestId") == str(request_id)
            )
        ]
    if (
        isinstance(run.error, dict)
        and run.error.get("code") == "seer_command_dispatch_failed"
        and run.error.get("requestId") == str(request_id)
    ):
        run.error = None
    run.projection = projection


def _requeue_failed_command(
    run: InvestigationOrchestrationRun,
    command: InvestigationOrchestrationCommand,
) -> None:
    queued: list[InvestigationOrchestrationCommand] = []
    now = timezone.now()
    for candidate in InvestigationOrchestrationCommand.objects.filter(
        orchestration_run=run,
        id__gte=command.id,
        status=InvestigationOrchestrationCommandStatus.FAILED,
    ).order_by("id"):
        error_code = candidate.error.get("code") if isinstance(candidate.error, dict) else None
        if candidate.id == command.id or error_code == "earlier_command_failed":
            candidate.status = InvestigationOrchestrationCommandStatus.ACCEPTED
            candidate.error = None
            candidate.date_updated = now
            queued.append(candidate)
    if queued:
        InvestigationOrchestrationCommand.objects.bulk_update(
            queued,
            ["status", "error", "date_updated"],
        )
    _clear_command_dispatch_error(run, request_id=command.request_id)
    run.save(update_fields=["projection", "error", "date_updated"])


def _reset_create_dispatch_failure(run: InvestigationOrchestrationRun) -> None:
    projection = deepcopy(run.projection)
    pending_input = projection.get("pendingInput")
    awaiting_input = isinstance(pending_input, dict)
    run.phase = (
        InvestigationOrchestrationPhase.INTAKE
        if awaiting_input
        else InvestigationOrchestrationPhase.BROAD_SCAN
    )
    run.status = (
        InvestigationOrchestrationStatus.AWAITING_INPUT
        if awaiting_input
        else InvestigationOrchestrationStatus.PENDING
    )
    run.error = None
    projection.update({"phase": run.phase, "status": run.status})
    errors = projection.get("errors")
    if isinstance(errors, list):
        projection["errors"] = [
            error
            for error in errors
            if not (isinstance(error, dict) and error.get("code") == "seer_dispatch_failed")
        ]
    run.projection = projection


def _is_run_retry(command_type: str, payload: dict[str, Any]) -> bool:
    return command_type == "retry" and payload.get("target") == "run"


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

        if Investigation.objects.filter(
            id=investigation.id, status=InvestigationStatus.ARCHIVED
        ).exists():
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})

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
            if run.seer_run_id is None and _is_run_retry(existing.type, existing.payload):
                from sentry.tasks.seer.investigation import (
                    dispatch_investigation_orchestration_create,
                )

                transaction.on_commit(
                    partial(dispatch_investigation_orchestration_create.delay, run.id),
                    using=router.db_for_write(InvestigationOrchestrationRun),
                )
            elif existing.status == InvestigationOrchestrationCommandStatus.FAILED:
                _requeue_failed_command(run, existing)
                from sentry.tasks.seer.investigation import (
                    dispatch_investigation_orchestration_commands,
                )

                transaction.on_commit(
                    partial(dispatch_investigation_orchestration_commands.delay, run.id),
                    using=router.db_for_write(InvestigationOrchestrationRun),
                )
            elif existing.status in {
                InvestigationOrchestrationCommandStatus.ACCEPTED,
                InvestigationOrchestrationCommandStatus.DISPATCHED,
            }:
                from sentry.tasks.seer.investigation import (
                    dispatch_investigation_orchestration_commands,
                )

                transaction.on_commit(
                    partial(dispatch_investigation_orchestration_commands.delay, run.id),
                    using=router.db_for_write(InvestigationOrchestrationRun),
                )
            return AcceptedOrchestrationCommand(run, existing, duplicate=True)

        if run.workflow_version != expected_workflow_version:
            raise InvestigationConflictError("Workflow version does not match.")

        _validate_command_target(
            run,
            command_type=command_type,
            payload=payload,
        )

        if run.seer_run_id is None and _is_run_retry(command_type, payload):
            command = InvestigationOrchestrationCommand.objects.create(
                orchestration_run=run,
                request_id=request_id,
                actor_id=actor_id,
                expected_workflow_version=expected_workflow_version,
                resulting_workflow_version=run.workflow_version,
                type=command_type,
                payload=deepcopy(payload),
                status=InvestigationOrchestrationCommandStatus.ACKNOWLEDGED,
            )
            _reset_create_dispatch_failure(run)
            run.date_updated = timezone.now()
            run.save(
                update_fields=[
                    "phase",
                    "status",
                    "projection",
                    "error",
                    "date_updated",
                ]
            )
            from sentry.tasks.seer.investigation import (
                dispatch_investigation_orchestration_create,
            )

            transaction.on_commit(
                partial(dispatch_investigation_orchestration_create.delay, run.id),
                using=router.db_for_write(InvestigationOrchestrationRun),
            )
            return AcceptedOrchestrationCommand(run, command, duplicate=False)

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
        if _command_invalidates_notebook(command_type, payload):
            _invalidate_notebook(run)
        run.date_updated = timezone.now()
        run.save(
            update_fields=[
                "workflow_version",
                "projection",
                "notebook_revision",
                "date_updated",
            ]
        )
        from sentry.tasks.seer.investigation import dispatch_investigation_orchestration_commands

        transaction.on_commit(
            partial(dispatch_investigation_orchestration_commands.delay, run.id),
            using=router.db_for_write(InvestigationOrchestrationRun),
        )
        return AcceptedOrchestrationCommand(run, command, duplicate=False)


def archive_investigation_with_orchestration(
    *, investigation: Investigation, expected_version: int, actor_id: int
) -> Investigation:
    """Durably cancel an active parent before archiving its notebook."""

    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = (
            InvestigationOrchestrationRun.objects.select_for_update()
            .filter(investigation=investigation)
            .first()
        )
        archive_version = expected_version
        if run is not None:
            investigation.refresh_from_db(fields=["version", "status"])
            if expected_version > investigation.version:
                raise InvestigationConflictError("Investigation has changed.")
            archive_version = investigation.version
        if run is not None and run.status not in {
            InvestigationOrchestrationStatus.COMPLETED,
            InvestigationOrchestrationStatus.FAILED,
            InvestigationOrchestrationStatus.CANCELLED,
        }:
            accept_orchestration_command(
                investigation=investigation,
                request_id=uuid5(
                    _ARCHIVE_CANCEL_NAMESPACE,
                    f"{investigation.id}:{expected_version}",
                ),
                expected_workflow_version=run.workflow_version,
                command_type="cancel",
                payload={"reason": "investigation_archived"},
                actor_id=actor_id,
            )
        if run is not None:
            run.refresh_from_db(fields=["generation", "projection"])
            projection = deepcopy(run.projection)
            control = projection.get(_CONTROL_KEY)
            if not isinstance(control, dict):
                control = {}
                projection[_CONTROL_KEY] = control
            control["notebookWriteFenceGeneration"] = run.generation
            run.projection = projection
            run.date_updated = timezone.now()
            run.save(update_fields=["projection", "date_updated"])
            now = timezone.now()
            InvestigationBlockExecution.objects.filter(
                block__orchestration_run=run,
                status__in=(
                    InvestigationBlockExecutionStatus.PENDING,
                    InvestigationBlockExecutionStatus.RUNNING,
                    InvestigationBlockExecutionStatus.AWAITING_INPUT,
                    InvestigationBlockExecutionStatus.STOPPING,
                ),
            ).update(
                status=InvestigationBlockExecutionStatus.CANCELLED,
                error={
                    "code": "investigation_archived",
                    "message": "The investigation was archived.",
                },
                completed_at=now,
                date_updated=now,
            )
        return archive_investigation(
            investigation=investigation,
            expected_version=archive_version,
        )


def update_investigation_with_orchestration(
    *,
    investigation: Investigation,
    expected_version: int,
    fields: dict[str, Any],
    project_ids: list[int] | None,
) -> Investigation:
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = (
            InvestigationOrchestrationRun.objects.select_for_update()
            .filter(investigation=investigation)
            .first()
        )
        # Agent title deltas continuously bump the aggregate version. The run lock makes a
        # manual title edit authoritative without weakening conflicts for any other update.
        if run is not None and set(fields) == {"title"} and project_ids is None:
            investigation = Investigation.objects.select_for_update().get(id=investigation.id)
            expected_version = investigation.version
        updated = update_investigation(
            investigation=investigation,
            expected_version=expected_version,
            fields=fields,
            project_ids=project_ids,
        )
        if run is not None and "title" in fields:
            projection = deepcopy(run.projection)
            control = projection.get(_CONTROL_KEY)
            if not isinstance(control, dict):
                control = {}
                projection[_CONTROL_KEY] = control
            control.update(
                {
                    "manualTitleOverride": True,
                    "titleBuffer": updated.title,
                    "titleStarted": True,
                }
            )
            run.projection = projection
            run.date_updated = timezone.now()
            run.save(update_fields=["projection", "date_updated"])
        return updated


def validate_agentic_source(source: Any) -> dict[str, Any]:
    """Validate the stable envelope while allowing additive source seed fields."""

    if not isinstance(source, dict):
        raise InvestigationValidationError({"source": "Must be an object."})
    if len(json.dumps(source).encode()) > MAX_AGENTIC_SOURCE_BYTES:
        raise InvestigationValidationError({"source": "Investigation context is too large."})
    source_type = source.get("type")
    if source_type not in {"manual", "breached_metric", "metric_open_period"}:
        raise InvestigationValidationError(
            {
                "source": (
                    "Agentic source type must be manual, breached_metric, or metric_open_period."
                )
            }
        )
    if source_type == "metric_open_period":
        if set(source) != {"type", "ref"}:
            raise InvestigationValidationError(
                {"source": "metric_open_period accepts only its server-resolved ref."}
            )
        ref = source.get("ref")
        if not isinstance(ref, dict) or set(ref) != {"groupId", "openPeriodId"}:
            raise InvestigationValidationError(
                {"source": "metric_open_period requires groupId and openPeriodId."}
            )
        for value in ref.values():
            if isinstance(value, bool) or not isinstance(value, int | str):
                raise InvestigationValidationError(
                    {"source": "groupId and openPeriodId must be IDs."}
                )
            try:
                if int(value) < 1:
                    raise ValueError
            except (TypeError, ValueError):
                raise InvestigationValidationError(
                    {"source": "groupId and openPeriodId must be positive IDs."}
                )
        return source
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
        if time_range is not None:
            if not isinstance(time_range, dict) or set(time_range) != {"start", "end"}:
                raise InvestigationValidationError({"source": "timeRange requires start and end."})
            start_value = time_range.get("start")
            end_value = time_range.get("end")
            start = parse_datetime(start_value) if isinstance(start_value, str) else None
            end = parse_datetime(end_value) if isinstance(end_value, str) else None
            if (
                start is None
                or end is None
                or not timezone.is_aware(start)
                or not timezone.is_aware(end)
                or end <= start
            ):
                raise InvestigationValidationError(
                    {"source": "timeRange must be an ordered timezone-aware range."}
                )
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


def manual_orchestration_source(source: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {
        "type": "manual",
        "projectScope": {"type": "investigation"},
        "seed": deepcopy(source.get("seed", {})),
    }
    for key in ("prompt", "timeRange"):
        if key in source:
            normalized[key] = deepcopy(source[key])
    return normalized


def breached_metric_orchestration_source(source: dict[str, Any]) -> dict[str, Any]:
    """Translate Sentry's immutable metric-open-period snapshot to Seer's source wire."""

    snapshot = source.get("snapshot")
    if not isinstance(snapshot, dict):
        raise InvestigationValidationError({"source": "Metric source snapshot is missing."})
    monitor = snapshot.get("monitor")
    project = snapshot.get("project")
    window = snapshot.get("analysisWindow")
    if (
        not isinstance(monitor, dict)
        or not isinstance(project, dict)
        or not isinstance(window, dict)
    ):
        raise InvestigationValidationError({"source": "Metric source snapshot is incomplete."})
    conditions = monitor.get("conditions", [])
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
    try:
        project_id = int(project["id"])
    except (KeyError, TypeError, ValueError) as error:
        raise InvestigationValidationError({"source": "Metric project is invalid."}) from error
    breach_start = window.get("breachStart")
    baseline_start = window.get("baselineStart")
    end = window.get("end")
    if not all(isinstance(value, str) for value in (breach_start, baseline_start, end)):
        raise InvestigationValidationError({"source": "Metric analysis window is invalid."})
    return {
        "type": "breached_metric",
        "metricIssueId": snapshot.get("groupId"),
        "openPeriodId": snapshot.get("openPeriodId"),
        "detectorId": monitor.get("id"),
        "monitorId": monitor.get("id"),
        "monitorName": monitor.get("name"),
        "metricQuery": monitor.get("query"),
        "projectIds": [project_id],
        "monitor": deepcopy(monitor),
        "project": deepcopy(project),
        "analysisWindow": deepcopy(window),
        "environment": monitor.get("environment"),
        "threshold": threshold,
        "thresholdDirection": monitor.get("direction"),
        "openPeriod": {"start": breach_start, "end": end},
        "baselinePeriod": {"start": baseline_start, "end": breach_start},
        "seed": {
            "groupTitle": snapshot.get("groupTitle"),
            "sentrySource": deepcopy(source),
        },
    }


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
    lineage_key = investigation_lineage_key("breached_metric", normalized_source)
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
            investigation, _ = create_agentic_investigation(
                organization=organization,
                user_id=user_id,
                title=title,
                source=normalized_source,
                orchestration_source=breached_metric_orchestration_source(normalized_source),
                project_ids=project_ids,
                filters=filters,
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
