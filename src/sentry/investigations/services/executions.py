from __future__ import annotations

import hashlib
from typing import Any
from uuid import UUID

from django.db import router, transaction
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationCell,
    InvestigationCellExecution,
    InvestigationCellExecutionStatus,
    InvestigationCellExecutor,
    InvestigationCellKind,
    InvestigationStatus,
)
from sentry.investigations.services.investigations import (
    InvestigationConflictError,
    InvestigationValidationError,
)
from sentry.utils import json

MAX_CONTEXT_CELLS = 20
MAX_CONTEXT_TEXT_CHARS = 50_000
MAX_CONTEXT_TABLE_ROWS = 25
MAX_CONTEXT_BYTES = 512 * 1024


def _fingerprint(snapshot: dict[str, Any]) -> str:
    serialized = json.dumps(snapshot, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


def _compact_query_context(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise InvestigationValidationError(
            {"context": "A query context cell has no usable result."}
        )
    raw_table = result.get("table")
    table = raw_table if isinstance(raw_table, dict) else {}
    raw_rows = table.get("rows")
    rows = raw_rows if isinstance(raw_rows, list) else []
    return {
        "schemaVersion": result.get("schemaVersion"),
        "query": result.get("query"),
        "table": {
            "columns": table.get("columns", []),
            "rows": rows[:MAX_CONTEXT_TABLE_ROWS],
            "totalRows": table.get("totalRows", len(rows)),
            "returnedRows": min(len(rows), MAX_CONTEXT_TABLE_ROWS),
            "truncated": bool(table.get("truncated")) or len(rows) > MAX_CONTEXT_TABLE_ROWS,
        },
        "warnings": result.get("warnings", []),
    }


def _materialize_dependency_context(
    cell: InvestigationCell, *, accessible_project_ids: set[int]
) -> tuple[dict[str, str | None], list[dict[str, Any]], list[int]]:
    links = list(
        cell.dependency_links.select_related(
            "depends_on__content_execution", "depends_on__current_execution"
        ).order_by("depends_on__position", "depends_on__uuid")
    )
    if len(links) > MAX_CONTEXT_CELLS:
        raise InvestigationValidationError(
            {"context": f"A cell can use at most {MAX_CONTEXT_CELLS} context cells."}
        )

    dependencies: dict[str, str | None] = {}
    context: list[dict[str, Any]] = []
    context_project_ids: set[int] = set()
    for link in links:
        dependency = link.depends_on
        dependency_execution = (
            dependency.current_execution
            if dependency.kind == InvestigationCellKind.QUERY
            else dependency.content_execution
        )
        dependencies[str(dependency.uuid)] = (
            str(dependency_execution.uuid) if dependency_execution is not None else None
        )
        item: dict[str, Any] = {
            "cell_id": str(dependency.uuid),
            "kind": dependency.kind,
            "title": dependency.title,
            "prompt": dependency.prompt,
        }

        if dependency.kind == InvestigationCellKind.QUERY:
            if (
                dependency_execution is None
                or dependency_execution.status != InvestigationCellExecutionStatus.COMPLETED
                or dependency.stale_at is not None
            ):
                raise InvestigationValidationError(
                    {
                        "context": f'Run the context cell "{dependency.title or "Untitled query"}" first.'
                    }
                )
            item["result"] = _compact_query_context(dependency_execution.result)
        else:
            item["content"] = dependency.content[:MAX_CONTEXT_TEXT_CHARS]

        if dependency_execution is not None:
            provenance = set(
                dependency_execution.data_projects.order_by("id").values_list("id", flat=True)
            )
            if not provenance.issubset(accessible_project_ids):
                raise InvestigationValidationError(
                    {"context": "One or more context cells use inaccessible project data."}
                )
            context_project_ids.update(provenance)
        context.append(item)

    if len(json.dumps(context).encode()) > MAX_CONTEXT_BYTES:
        raise InvestigationValidationError(
            {"context": "The selected cell context is too large to send to the agent."}
        )
    return dependencies, context, sorted(context_project_ids)


def build_cell_execution_snapshot(
    *,
    cell: InvestigationCell,
    project_ids: list[int],
    project_slugs: list[str],
    accessible_project_ids: set[int],
) -> tuple[dict[str, Any], str]:
    prompt = (cell.prompt or cell.content).strip()
    parameters = {
        link.parameter.key: link.parameter.saved_value
        for link in cell.parameter_links.select_related("parameter").order_by("parameter__key")
    }
    dependencies, context, context_project_ids = _materialize_dependency_context(
        cell, accessible_project_ids=accessible_project_ids
    )
    snapshot: dict[str, Any] = {
        "prompt": prompt,
        "filters": cell.investigation.filters,
        "parameters": parameters,
        "dependencies": dependencies,
        "context": context,
        "contextDataProjectIds": context_project_ids,
        "projectIds": project_ids,
        "projectSlugs": project_slugs,
        "cellVersion": cell.version,
        "investigationVersion": cell.investigation.version,
    }
    dataset_hint = cell.config.get("datasetHint")
    if dataset_hint is not None:
        snapshot["datasetHint"] = dataset_hint
    return snapshot, _fingerprint(snapshot)


def create_cell_execution(
    *,
    cell: InvestigationCell,
    expected_investigation_version: int,
    expected_cell_version: int,
    user_id: int,
    project_ids: list[int],
    project_slugs: list[str],
    accessible_project_ids: set[int],
    request_id: UUID | None = None,
) -> tuple[InvestigationCellExecution, bool]:
    """Create a new immutable execution, or return the same explicit request retry."""
    database = router.db_for_write(InvestigationCellExecution)
    with transaction.atomic(using=database):
        locked = (
            InvestigationCell.objects.select_for_update()
            .select_related("investigation")
            .get(id=cell.id)
        )
        if locked.investigation.version != expected_investigation_version:
            raise InvestigationConflictError("Investigation has changed.")
        if locked.version != expected_cell_version:
            raise InvestigationConflictError("Cell has changed.")
        if locked.deleted_at is not None:
            raise InvestigationValidationError({"detail": "The cell has been deleted."})
        if locked.investigation.status != InvestigationStatus.ACTIVE:
            raise InvestigationValidationError({"detail": "Archived investigations are read-only."})
        if locked.kind == InvestigationCellKind.TEXT and not locked.prompt.strip():
            raise InvestigationValidationError(
                {"detail": "The text cell needs a generation prompt."}
            )
        if (
            locked.kind == InvestigationCellKind.QUERY
            and not (locked.prompt or locked.content).strip()
        ):
            raise InvestigationValidationError({"detail": "The query cell needs a question."})
        if locked.kind == InvestigationCellKind.QUERY and not project_ids:
            raise InvestigationValidationError(
                {"detail": "Select at least one accessible project before running this query."}
            )
        if len(project_ids) != len(project_slugs):
            raise InvestigationValidationError({"detail": "Invalid project scope."})

        snapshot, fingerprint = build_cell_execution_snapshot(
            cell=locked,
            project_ids=project_ids,
            project_slugs=project_slugs,
            accessible_project_ids=accessible_project_ids,
        )
        if request_id is not None:
            requested_execution = InvestigationCellExecution.objects.filter(
                request_id=request_id
            ).first()
            if requested_execution is not None:
                if requested_execution.cell_id != locked.id:
                    raise InvestigationValidationError(
                        {"requestId": "This execution request ID is already in use."}
                    )
                return requested_execution, False

        current = locked.current_execution
        if (
            request_id is None
            and current is not None
            and current.cell_version == locked.version
            and current.input_fingerprint == fingerprint
            and current.status
            in {
                InvestigationCellExecutionStatus.PENDING,
                InvestigationCellExecutionStatus.RUNNING,
            }
        ):
            return current, False

        dataset_hint = (
            snapshot.get("datasetHint") if locked.kind == InvestigationCellKind.QUERY else None
        )
        if dataset_hint is not None and dataset_hint not in {
            "errors",
            "issues",
            "spans",
            "logs",
            "metrics",
        }:
            raise InvestigationValidationError({"detail": "The template dataset hint is invalid."})
        execution_values: dict[str, Any] = {
            "cell": locked,
            "triggered_by_id": user_id,
            "executor": (
                InvestigationCellExecutor.TEXT_GENERATION
                if locked.kind == InvestigationCellKind.TEXT
                else (
                    InvestigationCellExecutor.ASSISTED_QUERY
                    if dataset_hint is not None
                    else InvestigationCellExecutor.CODE_MODE
                )
            ),
            "status": InvestigationCellExecutionStatus.PENDING,
            "cell_version": locked.version,
            "input_snapshot": snapshot,
            "input_fingerprint": fingerprint,
            "result_schema_version": 1,
        }
        if request_id is not None:
            execution_values["request_id"] = request_id
        execution = InvestigationCellExecution.objects.create(**execution_values)
        locked.current_execution = execution
        locked.save(update_fields=["current_execution", "date_updated"])
        return execution, True


def mark_cell_execution_dispatched(
    execution: InvestigationCellExecution, *, seer_run_id: int
) -> None:
    InvestigationCellExecution.objects.filter(
        id=execution.id, status=InvestigationCellExecutionStatus.PENDING
    ).update(
        seer_run_id=seer_run_id,
        status=InvestigationCellExecutionStatus.RUNNING,
        started_at=timezone.now(),
    )


def mark_cell_execution_dispatch_failed(
    execution: InvestigationCellExecution, *, error: str
) -> None:
    InvestigationCellExecution.objects.filter(
        id=execution.id,
        status__in=[
            InvestigationCellExecutionStatus.PENDING,
            InvestigationCellExecutionStatus.RUNNING,
        ],
    ).update(
        status=InvestigationCellExecutionStatus.FAILED,
        error={"code": "dispatch_failed", "message": error[:1000]},
        completed_at=timezone.now(),
    )
