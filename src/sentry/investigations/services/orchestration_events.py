from __future__ import annotations

import hashlib
from copy import deepcopy
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid5

from django.db import IntegrityError, router, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import APIException

from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.contracts import (
    EVENT_PAYLOAD_SERIALIZERS,
    MAX_MARKDOWN_CHARS,
    OrchestrationProjectionSerializer,
    validate_text_result,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionProject,
    InvestigationBlockExecutionStatus,
    InvestigationBlockExecutor,
    InvestigationBlockKind,
    InvestigationOrchestrationEvent,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
    InvestigationProject,
    InvestigationStatus,
)
from sentry.models.project import Project
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.utils import json

MAX_ORCHESTRATION_EVENT_BYTES = 1024 * 1024
_REPORT_EXECUTION_NAMESPACE = UUID("7100c312-c3cf-4ba6-92e4-baa54ec227e3")
_CONTROL_KEY = "_sentryControl"
_TERMINAL_STATUSES = {"completed", "failed", "cancelled"}
_NOTEBOOK_EVENT_TYPES = {
    "report_clear",
    "report_block_started",
    "report_text_delta",
    "report_block_upserted",
    "report_block_removed",
    "report_block_moved",
    "report_completed",
    "report_failed",
    "title_delta",
    "metadata_completed",
}


class InvestigationOrchestrationEventConflict(APIException):
    status_code = 409
    default_detail = "The event identity conflicts with an existing event."
    default_code = "orchestration_event_conflict"


@dataclass(frozen=True)
class OrchestrationEventReceipt:
    duplicate: bool
    application_status: str
    last_applied_sequence: int
    notebook_revision: int

    @property
    def next_expected_sequence(self) -> int:
        return self.last_applied_sequence + 1


@dataclass(frozen=True)
class _OrchestrationEventApplication:
    event: InvestigationOrchestrationEvent
    last_applied_sequence: int
    notebook_revision: int


__all__ = [
    "InvestigationOrchestrationEventConflict",
    "OrchestrationEventReceipt",
    "deliver_orchestration_event",
    "reconcile_orchestration_projection",
    "synchronize_orchestration_projection",
]


def _serialized_size(value: Any) -> int:
    return len(json.dumps(value).encode())


def _validate_projection(projection: dict[str, Any]) -> dict[str, Any]:
    validator = OrchestrationProjectionSerializer(data=projection)
    if not validator.is_valid():
        raise serializers.ValidationError({"payload": validator.errors})  # type: ignore[dict-item]
    return validator.validated_data


def _projection_evidence_project_ids(projection: dict[str, Any]) -> set[int]:
    """Collect every project the projection's evidence claims to come from.

    The projection has already been validated, so the shape is known and only the
    optional keys need guarding.
    """

    project_ids: set[int] = set()
    for hypothesis in projection.get("hypotheses", []):
        evidence_groups = [hypothesis.get("evidence", [])]
        evidence_groups.extend(
            step.get("evidence", []) for step in hypothesis.get("verificationSteps", [])
        )
        for evidence_group in evidence_groups:
            for evidence in evidence_group:
                project_ids.update(evidence.get("projectIds") or [])
    return project_ids


def _validate_projection_project_scope(
    run: InvestigationOrchestrationRun, projection: dict[str, Any]
) -> None:
    project_ids = _projection_evidence_project_ids(projection)
    if not project_ids:
        return
    allowed_project_ids = set(
        InvestigationProject.objects.filter(investigation=run.investigation).values_list(
            "project_id", flat=True
        )
    )
    if not project_ids.issubset(allowed_project_ids):
        raise serializers.ValidationError(
            {"payload": "Projection evidence is outside the investigation project scope."}
        )


def _validate_event_payload(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Check the payload against the schema for its event type and normalize it.

    Unknown fields survive validation; Seer owns the shape of these payloads and
    may add to them before Sentry knows the field exists. The return value is what
    gets staged, so the apply path reads coerced values and never re-checks types.
    """

    schema = EVENT_PAYLOAD_SERIALIZERS.get(event_type)
    if schema is None:
        return payload
    validator = schema(data=payload)
    if not validator.is_valid():
        raise serializers.ValidationError({"payload": validator.errors})
    return validator.validated_data


def _stored_event_payload(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": event["schema_version"],
        "runId": event["run_id"],
        "investigationId": event["investigation_id"],
        "generation": event["generation"],
        "payload": deepcopy(event["payload"]),
    }


def _event_generation(event: InvestigationOrchestrationEvent) -> int:
    return int(event.payload["generation"])


def _event_data(event: InvestigationOrchestrationEvent) -> dict[str, Any]:
    value = event.payload.get("payload")
    return value if isinstance(value, dict) else {}


def _control(run: InvestigationOrchestrationRun) -> dict[str, Any]:
    value = run.projection.get(_CONTROL_KEY)
    if not isinstance(value, dict):
        value = {}
        run.projection[_CONTROL_KEY] = value
    return value


def _report_revision(run: InvestigationOrchestrationRun) -> int:
    value = _control(run).get("reportRevision", 0)
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _notebook_writes_are_fenced(run: InvestigationOrchestrationRun) -> bool:
    return run.investigation.status == InvestigationStatus.ARCHIVED


def _set_projection(
    run: InvestigationOrchestrationRun,
    projection: dict[str, Any],
    *,
    event_generation: int,
    authoritative_workflow_version: bool = False,
) -> None:
    projection = _validate_projection(projection)
    _validate_projection_project_scope(run, projection)
    investigation_id = projection.get("investigationId")
    run_id = projection.get("runId")
    generation = projection.get("generation")
    if isinstance(investigation_id, bool) or not isinstance(investigation_id, int | str):
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."})
    if isinstance(run_id, bool) or not isinstance(run_id, int | str):
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."})
    try:
        normalized_investigation_id = int(investigation_id)
        normalized_run_id = int(run_id)
    except (TypeError, ValueError) as error:
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."}) from error
    if (
        normalized_investigation_id != run.investigation_id
        or run.seer_run is None
        or normalized_run_id != run.seer_run.seer_run_state_id
        or generation != event_generation
    ):
        raise serializers.ValidationError(
            {"payload": "Projection IDs or generation do not match the event."}
        )

    previous_control = deepcopy(_control(run))
    run.projection = deepcopy(projection)
    run.projection[_CONTROL_KEY] = previous_control

    workflow_version = projection.get("workflowVersion")
    if isinstance(workflow_version, int) and not isinstance(workflow_version, bool):
        run.workflow_version = (
            workflow_version
            if authoritative_workflow_version
            else max(run.workflow_version, workflow_version)
        )
    run.generation = event_generation
    phase = projection.get("phase")
    if phase in InvestigationOrchestrationPhase.values:
        run.phase = phase
    status = projection.get("status")
    if status in InvestigationOrchestrationStatus.values:
        run.status = status
    heartbeat = projection["heartbeatAt"]
    assert isinstance(heartbeat, str)
    parsed_heartbeat = parse_datetime(heartbeat)
    assert parsed_heartbeat is not None and timezone.is_aware(parsed_heartbeat)
    run.heartbeat_at = parsed_heartbeat
    projection_error = projection.get("error")
    if projection_error is None or isinstance(projection_error, dict):
        run.error = deepcopy(projection_error)


def _projection_is_stale(
    run: InvestigationOrchestrationRun,
    projection: dict[str, Any],
    *,
    event_generation: int,
) -> bool:
    workflow_version = projection.get("workflowVersion")
    return (
        event_generation == run.generation
        and isinstance(workflow_version, int)
        and not isinstance(workflow_version, bool)
        and workflow_version < run.workflow_version
    )


def _finish_report_executions(
    run: InvestigationOrchestrationRun,
    *,
    status: str,
    error: dict[str, Any],
    revision: int | None = None,
    stable_agent_key: str | None = None,
    block_ids: list[int] | None = None,
) -> int:
    executions = InvestigationBlockExecution.objects.filter(
        block__investigation=run.investigation,
        block__report_revision__isnull=False,
        block__stable_agent_key__isnull=False,
        status__in=(
            InvestigationBlockExecutionStatus.PENDING,
            InvestigationBlockExecutionStatus.RUNNING,
            InvestigationBlockExecutionStatus.AWAITING_INPUT,
            InvestigationBlockExecutionStatus.STOPPING,
        ),
    )
    if revision is not None:
        executions = executions.filter(block__report_revision=revision)
    if stable_agent_key is not None:
        executions = executions.filter(block__stable_agent_key=stable_agent_key)
    if block_ids is not None:
        executions = executions.filter(block_id__in=block_ids)
    now = timezone.now()
    return executions.update(
        status=status,
        error=deepcopy(error),
        completed_at=now,
        date_updated=now,
    )


def _cancel_report_executions(
    run: InvestigationOrchestrationRun,
    *,
    revision: int | None = None,
    stable_agent_key: str | None = None,
    block_ids: list[int] | None = None,
) -> int:
    return _finish_report_executions(
        run,
        status=InvestigationBlockExecutionStatus.CANCELLED,
        error={
            "code": "investigation_report_restarted",
            "message": "The investigation report was restarted.",
        },
        revision=revision,
        stable_agent_key=stable_agent_key,
        block_ids=block_ids,
    )


def _fail_report_executions(
    run: InvestigationOrchestrationRun,
    *,
    revision: int | None = None,
) -> int:
    return _finish_report_executions(
        run,
        status=InvestigationBlockExecutionStatus.FAILED,
        error={
            "code": "investigation_report_failed",
            "message": "The investigation report could not be completed.",
        },
        revision=revision,
    )


def _cancel_workflow_report_executions(run: InvestigationOrchestrationRun) -> int:
    return _finish_report_executions(
        run,
        status=InvestigationBlockExecutionStatus.CANCELLED,
        error={
            "code": "investigation_cancelled",
            "message": "The investigation was cancelled.",
        },
    )


def _adopt_preserved_report_revision(
    run: InvestigationOrchestrationRun, projection: dict[str, Any]
) -> bool:
    report = projection.get("report")
    if not isinstance(report, dict) or report.get("clearIntent") is not None:
        return False
    revision = report.get("revision")
    if (
        isinstance(revision, bool)
        or not isinstance(revision, int)
        or revision <= _report_revision(run)
    ):
        return False
    live_blocks = InvestigationBlock.objects.filter(
        investigation=run.investigation,
        report_revision__isnull=False,
        stable_agent_key__isnull=False,
        deleted_at__isnull=True,
    )
    completed_ids = list(
        live_blocks.filter(
            current_execution__status=InvestigationBlockExecutionStatus.COMPLETED
        ).values_list("id", flat=True)
    )
    discarded_ids = list(live_blocks.exclude(id__in=completed_ids).values_list("id", flat=True))
    now = timezone.now()
    if completed_ids:
        InvestigationBlock.objects.filter(id__in=completed_ids).update(
            report_revision=revision,
            date_updated=now,
        )
    if discarded_ids:
        _cancel_report_executions(run, block_ids=discarded_ids)
        InvestigationBlock.objects.filter(id__in=discarded_ids).update(
            deleted_at=now,
            date_updated=now,
        )
    _control(run).update({"reportRevision": revision, "reportCleared": False})
    return bool(discarded_ids)


def _bump_notebook(run: InvestigationOrchestrationRun, investigation: Investigation) -> None:
    run.notebook_revision += 1
    report = run.projection.setdefault("report", {})
    if isinstance(report, dict):
        report["notebookRevision"] = run.notebook_revision
    investigation.version += 1
    investigation.date_updated = timezone.now()
    investigation.save(update_fields=["version", "date_updated"])


def _normalize_positions(run: InvestigationOrchestrationRun, moved: InvestigationBlock) -> None:
    blocks = list(
        InvestigationBlock.objects.filter(
            investigation=run.investigation,
            report_revision__isnull=False,
            stable_agent_key__isnull=False,
            deleted_at__isnull=True,
        )
        .exclude(id=moved.id)
        .order_by("position", "id")
    )
    position = min(max(moved.position, 0), len(blocks))
    blocks.insert(position, moved)
    changed: list[InvestigationBlock] = []
    for index, block in enumerate(blocks):
        if block.position != index:
            block.position = index
            changed.append(block)
    if changed:
        InvestigationBlock.objects.bulk_update(changed, ["position", "date_updated"])


def _default_display(kind: str) -> dict[str, Any]:
    if kind == InvestigationBlockKind.TEXT:
        return {"type": "markdown"}
    return {
        "version": 1,
        "type": "table",
        "defaultView": "table",
        "queryCollapsed": True,
    }


def _upsert_report_block(
    *,
    run: InvestigationOrchestrationRun,
    payload: dict[str, Any],
    complete: bool,
) -> InvestigationBlock:
    investigation = run.investigation
    revision = payload["reportRevision"]
    key = payload["stableAgentKey"]
    kind = payload["kind"]
    block = InvestigationBlock.objects.filter(
        investigation=investigation,
        report_revision=revision,
        stable_agent_key=key,
    ).first()
    if block is None:
        # Optional on the schema because an update may reuse the stored position,
        # but a block being created has none to fall back on.
        if "position" not in payload:
            raise serializers.ValidationError({"payload": "position is required for a new block."})
        position = payload["position"]
        block = InvestigationBlock(
            investigation=investigation,
            report_revision=revision,
            stable_agent_key=key,
            position=position,
            kind=kind,
        )
    elif block.kind != kind:
        raise serializers.ValidationError({"payload": "A report block cannot change kind."})

    if "position" in payload:
        block.position = payload["position"]
    title = payload.get("title", block.title)
    config = payload.get("config", block.config)
    display = payload.get("display", block.display or _default_display(kind))
    if kind == InvestigationBlockKind.QUERY:
        display = {**display, "queryCollapsed": display.get("queryCollapsed", True)}

    block.title = title
    block.config = deepcopy(config)
    block.display = deepcopy(display)
    block.producing_seer_run_id = payload.get("producingRunId")
    block.deleted_at = None
    if complete:
        content = payload.get("content", block.content)
        generated = payload.get("generatedContent", content)
        prompt = payload.get("generationPrompt", block.prompt)
        block.content = content
        block.generated_content = generated
        block.prompt = prompt
    if block.pk:
        block.version += 1
    block.save()
    _normalize_positions(run, block)

    project_ids = list(payload.get("projectIds") or [])
    if payload.get("useInvestigationProjectScope") is True:
        project_scope = run.source.get("projectScope")
        if run.source.get("type") != "manual" or project_scope != {"type": "investigation"}:
            raise serializers.ValidationError(
                {"payload": "Investigation project scope is not available for this run."}
            )
        scoped_project_ids = InvestigationProject.objects.filter(
            investigation=investigation
        ).values_list("project_id", flat=True)
        project_ids = sorted(set(project_ids) | set(scoped_project_ids))
        if not project_ids:
            raise serializers.ValidationError({"payload": "Investigation project scope is empty."})
    projects = list(
        Project.objects.filter(
            organization_id=investigation.organization_id,
            id__in=project_ids,
        ).order_by("id")
    )
    if {project.id for project in projects} != set(project_ids):
        raise serializers.ValidationError(
            {"payload": "A result project is outside the investigation organization."}
        )
    request_id = uuid5(
        _REPORT_EXECUTION_NAMESPACE,
        f"{run.id}:{revision}:{key}:{kind}",
    )
    snapshot = {
        "orchestrationRunId": run.id,
        "reportRevision": revision,
        "stableAgentKey": key,
        "projectIds": project_ids,
    }
    result = (
        # The block upsert schema has already normalized this.
        payload["result"]
        if kind == InvestigationBlockKind.QUERY and complete
        else validate_text_result(
            {
                "schemaVersion": 1,
                "markdown": block.generated_content,
            }
        )
        if complete
        else None
    )
    execution, _ = InvestigationBlockExecution.objects.update_or_create(
        request_id=request_id,
        defaults={
            "block": block,
            "executor": InvestigationBlockExecutor.CODE_MODE,
            "status": (
                InvestigationBlockExecutionStatus.COMPLETED
                if complete
                else InvestigationBlockExecutionStatus.RUNNING
            ),
            "block_version": block.version,
            "input_snapshot": snapshot,
            "input_fingerprint": hashlib.sha256(
                json.dumps(snapshot, sort_keys=True).encode()
            ).hexdigest(),
            "result_schema_version": 1,
            "result": result,
            "error": None,
            "started_at": timezone.now(),
            "completed_at": timezone.now() if complete else None,
        },
    )
    InvestigationBlockExecutionProject.objects.filter(execution=execution).delete()
    InvestigationBlockExecutionProject.objects.bulk_create(
        [
            InvestigationBlockExecutionProject(execution=execution, project=project)
            for project in projects
        ]
    )
    block.current_execution = execution
    if kind == InvestigationBlockKind.QUERY:
        if complete or block.result_execution_id is None:
            block.result_execution = execution
    else:
        if complete or block.content_execution_id is None:
            block.content_execution = execution
    if complete:
        block.stale_at = None
    block.save(
        update_fields=[
            "current_execution",
            "content_execution",
            "result_execution",
            "stale_at",
            "date_updated",
        ]
    )
    return block


def _clear_report(
    run: InvestigationOrchestrationRun,
    revision: int,
    *,
    force: bool = False,
    bump: bool = True,
    mutate_projection: bool = True,
) -> bool:
    control = _control(run)
    current_revision = _report_revision(run)
    if revision < current_revision or (
        revision == current_revision and control.get("reportCleared") and not force
    ):
        return False
    now = timezone.now()
    live_blocks = InvestigationBlock.objects.filter(
        investigation=run.investigation,
        report_revision__isnull=False,
        stable_agent_key__isnull=False,
        deleted_at__isnull=True,
    )
    _cancel_report_executions(
        run,
        block_ids=list(live_blocks.values_list("id", flat=True)),
    )
    live_blocks.update(deleted_at=now, date_updated=now)
    control.update(
        {
            "reportRevision": revision,
            "reportCleared": True,
            "titleBuffer": "",
            "titleStarted": False,
        }
    )
    if mutate_projection:
        report = run.projection.setdefault("report", {})
        if isinstance(report, dict):
            report.update({"revision": revision, "status": "composing", "error": None})
    if bump:
        _bump_notebook(run, run.investigation)
    return True


def _complete_metadata(
    run: InvestigationOrchestrationRun,
    payload: dict[str, Any],
    *,
    bump: bool = True,
) -> None:
    investigation = run.investigation
    summary = payload["summary"]
    description = payload["summaryDescription"]
    update_fields = ["summary", "summary_description", "version", "date_updated"]
    investigation.summary = summary
    investigation.summary_description = description
    title = payload.get("title")
    if title is not None:
        investigation.title = title
        update_fields.append("title")
        _control(run)["titleBuffer"] = title
    investigation.version += 1
    investigation.date_updated = timezone.now()
    investigation.save(update_fields=update_fields)
    metadata = run.projection.setdefault("report", {}).setdefault("metadata", {})
    if isinstance(metadata, dict):
        metadata.update(
            {
                "status": "completed",
                "title": investigation.title,
                "summary": summary,
                "summaryDescription": description,
                "error": None,
            }
        )
    if bump:
        run.notebook_revision += 1
        report = run.projection.setdefault("report", {})
        if isinstance(report, dict):
            report["notebookRevision"] = run.notebook_revision


def _apply_snapshot(
    run: InvestigationOrchestrationRun,
    event: InvestigationOrchestrationEvent,
    payload: dict[str, Any],
) -> None:
    generation = _event_generation(event)
    projection = payload["projection"]
    _set_projection(run, projection, event_generation=generation)
    if "blocks" not in payload:
        return
    blocks = payload["blocks"]
    revision = payload.get("reportRevision", projection.get("report", {}).get("revision", 0))
    _clear_report(run, revision, force=True, bump=False, mutate_projection=False)
    seen_keys: set[str] = set()
    for position, raw_block in enumerate(blocks):
        block_payload = deepcopy(raw_block)
        block_payload.setdefault("reportRevision", revision)
        block_payload.setdefault("position", position)
        block_payload = _validate_event_payload("report_block_upserted", block_payload)
        key = block_payload["stableAgentKey"]
        if key in seen_keys:
            raise serializers.ValidationError({"payload": "Snapshot block keys must be unique."})
        seen_keys.add(key)
        _upsert_report_block(
            run=run,
            payload=block_payload,
            complete=True,
        )
    metadata = payload.get("metadata")
    if metadata is not None:
        metadata = {**metadata, "reportRevision": revision}
        metadata = _validate_event_payload("metadata_completed", metadata)
        _complete_metadata(run, metadata, bump=False)
    _bump_notebook(run, run.investigation)


def _apply_event(
    run: InvestigationOrchestrationRun, event: InvestigationOrchestrationEvent
) -> tuple[bool, str | None]:
    # Events are staged verbatim so that their identity does not move when Sentry's
    # schemas change. Normalizing here is what lets the apply path read coerced
    # values and defaults without re-checking any types.
    payload = _validate_event_payload(event.type, _event_data(event))
    generation = _event_generation(event)
    if generation < run.generation:
        return False, "stale_generation"
    # A projection is what establishes a new generation, so only an event carrying
    # one may move the run forward.
    carries_projection = event.type in {"workflow_updated", "state_snapshot"} or (
        event.type == "workflow_failed" and isinstance(payload.get("projection"), dict)
    )
    if generation > run.generation and not carries_projection:
        return False, "future_generation_without_projection"
    notebook_writes_are_fenced = _notebook_writes_are_fenced(run)
    if notebook_writes_are_fenced and event.type in _NOTEBOOK_EVENT_TYPES:
        return False, "notebook_write_fenced"

    if event.type == "workflow_updated":
        if _projection_is_stale(run, payload["projection"], event_generation=generation):
            return False, "stale_workflow_version"
        notebook_changed = False
        if not notebook_writes_are_fenced:
            notebook_changed = _adopt_preserved_report_revision(run, payload["projection"])
        _set_projection(run, payload["projection"], event_generation=generation)
        if (
            not notebook_writes_are_fenced
            and run.status == InvestigationOrchestrationStatus.CANCELLED
        ):
            notebook_changed = bool(_cancel_workflow_report_executions(run)) or notebook_changed
        if notebook_changed:
            _bump_notebook(run, run.investigation)
    elif event.type == "state_snapshot":
        if _projection_is_stale(run, payload["projection"], event_generation=generation):
            return False, "stale_workflow_version"
        if notebook_writes_are_fenced:
            _set_projection(run, payload["projection"], event_generation=generation)
        else:
            _apply_snapshot(run, event, payload)
    elif event.type == "report_clear":
        if not _clear_report(run, payload["reportRevision"]):
            return False, "stale_report_revision"
    elif event.type in {
        "report_block_started",
        "report_text_delta",
        "report_block_upserted",
        "report_block_removed",
        "report_block_moved",
        "report_completed",
        "report_failed",
        "title_delta",
        "metadata_completed",
    }:
        revision = payload["reportRevision"]
        if revision != _report_revision(run):
            return False, "stale_report_revision"

        if event.type == "report_block_started":
            _upsert_report_block(
                run=run,
                payload=payload,
                complete=False,
            )
            _bump_notebook(run, run.investigation)
        elif event.type == "report_text_delta":
            block = InvestigationBlock.objects.filter(
                investigation=run.investigation,
                report_revision=revision,
                stable_agent_key=payload["stableAgentKey"],
                deleted_at__isnull=True,
                kind=InvestigationBlockKind.TEXT,
            ).first()
            if block is None:
                raise serializers.ValidationError({"payload": "Text block was not started."})
            if block.content_execution_id == block.current_execution_id:
                delta = payload["delta"]
                reset = payload.get("reset") is True
                if (0 if reset else len(block.content)) + len(delta) > MAX_MARKDOWN_CHARS:
                    raise serializers.ValidationError(
                        {"payload": "Text block exceeds its size limit."}
                    )
                block.content = delta if reset else block.content + delta
                block.generated_content = delta if reset else block.generated_content + delta
                block.version += 1
                block.save(
                    update_fields=["content", "generated_content", "version", "date_updated"]
                )
                _bump_notebook(run, run.investigation)
        elif event.type == "report_block_upserted":
            _upsert_report_block(
                run=run,
                payload=payload,
                complete=True,
            )
            _bump_notebook(run, run.investigation)
        elif event.type == "report_block_removed":
            now = timezone.now()
            _cancel_report_executions(
                run,
                revision=revision,
                stable_agent_key=payload["stableAgentKey"],
            )
            updated = InvestigationBlock.objects.filter(
                investigation=run.investigation,
                report_revision=revision,
                stable_agent_key=payload["stableAgentKey"],
                deleted_at__isnull=True,
            ).update(deleted_at=now, date_updated=now)
            if updated:
                _bump_notebook(run, run.investigation)
        elif event.type == "report_block_moved":
            block = InvestigationBlock.objects.filter(
                investigation=run.investigation,
                report_revision=revision,
                stable_agent_key=payload["stableAgentKey"],
                deleted_at__isnull=True,
            ).first()
            if block is None:
                raise serializers.ValidationError({"payload": "Report block was not found."})
            block.position = payload["position"]
            block.version += 1
            block.save(update_fields=["position", "version", "date_updated"])
            _normalize_positions(run, block)
            _bump_notebook(run, run.investigation)
        elif event.type == "report_completed":
            report = run.projection.setdefault("report", {})
            if isinstance(report, dict):
                report.update({"status": "completed", "error": None})
        elif event.type == "report_failed":
            execution_updated = _fail_report_executions(run, revision=revision)
            report = run.projection.setdefault("report", {})
            if isinstance(report, dict):
                report.update({"status": "failed", "error": deepcopy(payload.get("error"))})
            if execution_updated:
                _bump_notebook(run, run.investigation)
        elif event.type == "title_delta":
            control = _control(run)
            title = (
                control.get("titleBuffer", "")
                if control.get("titleStarted") and payload.get("reset") is not True
                else ""
            )
            title = f"{title}{payload['delta']}"[:255]
            control.update({"titleBuffer": title, "titleStarted": True})
            investigation = run.investigation
            investigation.title = title
            investigation.save(update_fields=["title", "date_updated"])
            metadata = run.projection.setdefault("report", {}).setdefault("metadata", {})
            if isinstance(metadata, dict):
                metadata.update({"status": "generating", "title": title})
            _bump_notebook(run, investigation)
        elif event.type == "metadata_completed":
            _complete_metadata(run, payload)
    elif event.type == "workflow_failed":
        # A delayed failure still fails the run, but it must not replace state
        # that a newer projection has already established.
        projection = payload.get("projection")
        if isinstance(projection, dict) and not _projection_is_stale(
            run, projection, event_generation=generation
        ):
            _set_projection(run, projection, event_generation=generation)
        run.phase = InvestigationOrchestrationPhase.FAILED
        run.status = InvestigationOrchestrationStatus.FAILED
        run.error = deepcopy(payload.get("error"))
        if _fail_report_executions(run, revision=_report_revision(run)):
            _bump_notebook(run, run.investigation)

    run.heartbeat_at = timezone.now()
    return True, None


def _is_terminal_full_snapshot(
    event: InvestigationOrchestrationEvent, run: InvestigationOrchestrationRun
) -> bool:
    if event.type != "state_snapshot":
        return False
    payload = _event_data(event)
    projection = payload.get("projection")
    return (
        payload.get("terminal") is True
        and payload.get("full") is True
        and isinstance(payload.get("blocks"), list)
        and isinstance(projection, dict)
        and projection.get("status") in _TERMINAL_STATUSES
        and projection.get("generation") == _event_generation(event)
        and not _projection_is_stale(run, projection, event_generation=_event_generation(event))
    )


def _mark_event(
    event: InvestigationOrchestrationEvent,
    status: str,
    *,
    error: dict[str, Any] | None = None,
) -> None:
    event.application_status = status
    event.error = error
    event.applied_at = timezone.now()
    event.save(update_fields=["application_status", "error", "applied_at", "date_updated"])


def _lock_run_after_investigation(
    orchestration_run_id: int,
) -> InvestigationOrchestrationRun:
    Investigation.objects.select_for_update(of=("self",)).get(
        orchestration_run__id=orchestration_run_id
    )
    return (
        InvestigationOrchestrationRun.objects.select_for_update(of=("self",))
        .select_related("investigation")
        .get(id=orchestration_run_id)
    )


def _apply_available_events(
    orchestration_run_id: int, delivered_event_id: int
) -> _OrchestrationEventApplication:
    """Consume contiguous events after rollback; only a valid terminal snapshot may skip a gap."""

    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = _lock_run_after_investigation(orchestration_run_id)
        delivered = InvestigationOrchestrationEvent.objects.get(id=delivered_event_id)
        if delivered.sequence <= run.last_event_sequence:
            if delivered.application_status == InvestigationOrchestrationEventStatus.PENDING:
                _mark_event(
                    delivered,
                    InvestigationOrchestrationEventStatus.IGNORED,
                    error={"reason": "superseded_by_snapshot"},
                )
        elif delivered.sequence > run.last_event_sequence + 1 and _is_terminal_full_snapshot(
            delivered, run
        ):
            try:
                with transaction.atomic(using=database):
                    applied, ignored_reason = _apply_event(run, delivered)
            except serializers.ValidationError as error:
                run.refresh_from_db()
                run.investigation.refresh_from_db()
                _mark_event(
                    delivered,
                    InvestigationOrchestrationEventStatus.FAILED,
                    error={"detail": error.detail},
                )
                applied = False
                ignored_reason = None
            if not applied:
                if ignored_reason is not None:
                    _mark_event(
                        delivered,
                        InvestigationOrchestrationEventStatus.IGNORED,
                        error={"reason": ignored_reason},
                    )
                run.date_updated = timezone.now()
                run.save(update_fields=["date_updated"])
                return _OrchestrationEventApplication(
                    event=delivered,
                    last_applied_sequence=run.last_event_sequence,
                    notebook_revision=run.notebook_revision,
                )
            InvestigationOrchestrationEvent.objects.filter(
                orchestration_run=run,
                sequence__lt=delivered.sequence,
                application_status=InvestigationOrchestrationEventStatus.PENDING,
            ).update(
                application_status=InvestigationOrchestrationEventStatus.IGNORED,
                error={"reason": "superseded_by_terminal_snapshot"},
                applied_at=timezone.now(),
                date_updated=timezone.now(),
            )
            _mark_event(delivered, InvestigationOrchestrationEventStatus.APPLIED)
            run.last_event_sequence = delivered.sequence
        else:
            while True:
                next_event = InvestigationOrchestrationEvent.objects.filter(
                    orchestration_run=run,
                    sequence=run.last_event_sequence + 1,
                ).first()
                if next_event is None:
                    break
                if next_event.application_status != InvestigationOrchestrationEventStatus.PENDING:
                    run.last_event_sequence = next_event.sequence
                    continue
                try:
                    with transaction.atomic(using=database):
                        applied, ignored_reason = _apply_event(run, next_event)
                except serializers.ValidationError as error:
                    run.refresh_from_db()
                    run.investigation.refresh_from_db()
                    _mark_event(
                        next_event,
                        InvestigationOrchestrationEventStatus.FAILED,
                        error={"detail": error.detail},
                    )
                else:
                    _mark_event(
                        next_event,
                        (
                            InvestigationOrchestrationEventStatus.APPLIED
                            if applied
                            else InvestigationOrchestrationEventStatus.IGNORED
                        ),
                        error={"reason": ignored_reason} if ignored_reason else None,
                    )
                run.last_event_sequence = next_event.sequence

        run.date_updated = timezone.now()
        run.save(
            update_fields=[
                "seer_run",
                "workflow_version",
                "generation",
                "phase",
                "status",
                "projection",
                "notebook_revision",
                "last_event_sequence",
                "heartbeat_at",
                "error",
                "date_updated",
            ]
        )
        delivered.refresh_from_db()
        return _OrchestrationEventApplication(
            event=delivered,
            last_applied_sequence=run.last_event_sequence,
            notebook_revision=run.notebook_revision,
        )


def _resolve_seer_run_mirror(
    *,
    seer_run_state_id: int,
    organization_id: int,
    user_id: int | None,
) -> SeerRun:
    """Find or create the SeerRun mirror for a run id Seer reported.

    Seer can report a run id before Sentry has committed the one its create call
    returned, so the mirror may not exist yet. It is live on arrival: the id only
    exists because Seer already accepted the run, and the create outbox does not
    dispatch this type, so nothing else can advance it.
    """

    seer_run, _ = SeerRun.objects.get_or_create(
        seer_run_state_id=seer_run_state_id,
        defaults={
            "organization_id": organization_id,
            "type": SeerRunType.INVESTIGATION,
            "user_id": user_id,
            "mirror_status": SeerRunMirrorStatus.LIVE,
            "last_triggered_at": timezone.now(),
        },
    )
    if seer_run.organization_id != organization_id:
        raise serializers.ValidationError({"event": "Run ID does not match."})
    return seer_run


def deliver_orchestration_event(
    *,
    organization_id: int,
    event: dict[str, Any],
) -> OrchestrationEventReceipt:
    """Stage an event, then consume contiguous work or fast-forward with a valid terminal snapshot."""

    if _serialized_size(event) > MAX_ORCHESTRATION_EVENT_BYTES:
        raise serializers.ValidationError({"event": "Event exceeds the maximum size."})
    _validate_event_payload(event["type"], event["payload"])
    stored_payload = _stored_event_payload(event)
    database = router.db_for_write(InvestigationOrchestrationRun)
    duplicate = False
    with transaction.atomic(using=database):
        try:
            run = (
                InvestigationOrchestrationRun.objects.select_for_update(of=("self",))
                .select_related("investigation", "seer_run")
                .get(
                    investigation_id=event["investigation_id"],
                    investigation__organization_id=organization_id,
                )
            )
        except InvestigationOrchestrationRun.DoesNotExist as error:
            raise serializers.ValidationError(
                {"event": "Investigation run was not found."}
            ) from error
        if run.seer_run is not None and run.seer_run.seer_run_state_id != event["run_id"]:
            raise serializers.ValidationError({"event": "Run ID does not match."})
        if run.seer_run is None:
            # Seer can emit its first event before Sentry has committed the run id
            # its create call returned, so adopt the id from the event. get_or_create
            # keeps this idempotent with the dispatch path, whichever wins.
            seer_run = _resolve_seer_run_mirror(
                seer_run_state_id=event["run_id"],
                organization_id=organization_id,
                user_id=run.investigation.created_by_id,
            )
            if InvestigationOrchestrationRun.objects.filter(seer_run=seer_run).exists():
                raise InvestigationOrchestrationEventConflict("Run ID is already in use.")
            run.seer_run = seer_run
            try:
                with transaction.atomic(using=database):
                    run.save(update_fields=["seer_run", "date_updated"])
            except IntegrityError as error:
                raise InvestigationOrchestrationEventConflict(
                    "Run ID is already in use."
                ) from error

        existing = InvestigationOrchestrationEvent.objects.filter(
            orchestration_run=run, event_id=event["event_id"]
        ).first()
        if existing is not None:
            if (
                existing.sequence != event["sequence"]
                or existing.type != event["type"]
                or existing.payload != stored_payload
            ):
                raise InvestigationOrchestrationEventConflict
            delivered = existing
            duplicate = True
        else:
            sequence_collision = InvestigationOrchestrationEvent.objects.filter(
                orchestration_run=run, sequence=event["sequence"]
            ).exists()
            if sequence_collision:
                raise InvestigationOrchestrationEventConflict
            delivered = InvestigationOrchestrationEvent.objects.create(
                orchestration_run=run,
                event_id=event["event_id"],
                sequence=event["sequence"],
                type=event["type"],
                payload=stored_payload,
            )

    outcome = _apply_available_events(run.id, delivered.id)
    return OrchestrationEventReceipt(
        duplicate=duplicate,
        application_status=outcome.event.application_status,
        last_applied_sequence=outcome.last_applied_sequence,
        notebook_revision=outcome.notebook_revision,
    )


def _synchronize_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
    authoritative: bool,
) -> InvestigationOrchestrationRun:
    if (
        isinstance(seer_run_id, bool)
        or not isinstance(seer_run_id, int)
        or not 1 <= seer_run_id <= I64_MAX
    ):
        raise serializers.ValidationError({"seer_run_id": "seer_run_id is invalid."})
    generation = projection.get("generation")
    if (
        isinstance(generation, bool)
        or not isinstance(generation, int)
        or not 1 <= generation <= I32_MAX
    ):
        raise serializers.ValidationError({"projection": "generation is invalid."})
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = _lock_run_after_investigation(orchestration_run_id)
        if run.seer_run is not None and run.seer_run.seer_run_state_id != seer_run_id:
            raise InvestigationOrchestrationEventConflict("Run ID does not match.")
        run.seer_run = _resolve_seer_run_mirror(
            seer_run_state_id=seer_run_id,
            organization_id=run.investigation.organization_id,
            user_id=run.investigation.created_by_id,
        )
        if authoritative or (
            generation >= run.generation
            and not _projection_is_stale(run, projection, event_generation=generation)
        ):
            notebook_changed = _adopt_preserved_report_revision(run, projection)
            _set_projection(
                run,
                projection,
                event_generation=generation,
                authoritative_workflow_version=authoritative,
            )
            if run.status == InvestigationOrchestrationStatus.CANCELLED:
                notebook_changed = bool(_cancel_workflow_report_executions(run)) or notebook_changed
            if notebook_changed:
                _bump_notebook(run, run.investigation)
        run.date_updated = timezone.now()
        run.save(
            update_fields=[
                "seer_run",
                "workflow_version",
                "generation",
                "phase",
                "status",
                "projection",
                "notebook_revision",
                "heartbeat_at",
                "error",
                "date_updated",
            ]
        )
        return run


def synchronize_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
) -> InvestigationOrchestrationRun:
    """Apply a monotonic create or command response without consuming callback sequence."""

    return _synchronize_orchestration_projection(
        orchestration_run_id=orchestration_run_id,
        seer_run_id=seer_run_id,
        projection=projection,
        authoritative=False,
    )


def reconcile_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
) -> InvestigationOrchestrationRun:
    """Replace run state from an authoritative recovery response."""

    return _synchronize_orchestration_projection(
        orchestration_run_id=orchestration_run_id,
        seer_run_id=seer_run_id,
        projection=projection,
        authoritative=True,
    )
