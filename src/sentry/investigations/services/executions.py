from __future__ import annotations

import hashlib
from typing import Any

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


def _fingerprint(snapshot: dict[str, Any]) -> str:
    serialized = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()


def build_query_execution_snapshot(
    *, cell: InvestigationCell, project_ids: list[int], project_slugs: list[str]
) -> tuple[dict[str, Any], str]:
    prompt = (cell.prompt or cell.content).strip()
    parameters = {
        link.parameter.key: link.parameter.saved_value
        for link in cell.parameter_links.select_related("parameter").order_by("parameter__key")
    }
    dependencies: dict[str, str | None] = {}
    for link in cell.dependency_links.select_related("depends_on__current_execution").order_by(
        "depends_on__uuid"
    ):
        dependency_execution = link.depends_on.current_execution
        dependencies[str(link.depends_on.uuid)] = (
            str(dependency_execution.uuid) if dependency_execution is not None else None
        )
    snapshot: dict[str, Any] = {
        "prompt": prompt,
        "filters": cell.investigation.filters,
        "parameters": parameters,
        "dependencies": dependencies,
        "projectIds": project_ids,
        "projectSlugs": project_slugs,
        "cellVersion": cell.version,
        "investigationVersion": cell.investigation.version,
    }
    dataset_hint = cell.config.get("datasetHint")
    if dataset_hint is not None:
        snapshot["datasetHint"] = dataset_hint
    return snapshot, _fingerprint(snapshot)


def create_query_execution(
    *,
    cell: InvestigationCell,
    expected_investigation_version: int,
    expected_cell_version: int,
    user_id: int,
    project_ids: list[int],
    project_slugs: list[str],
) -> tuple[InvestigationCellExecution, bool]:
    """Create and select an immutable execution, or return the matching active retry."""
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
        if locked.kind != InvestigationCellKind.QUERY:
            raise InvestigationValidationError({"detail": "Only query cells can be executed."})
        if not (locked.prompt or locked.content).strip():
            raise InvestigationValidationError({"detail": "The query cell needs a question."})
        if not project_ids:
            raise InvestigationValidationError(
                {"detail": "Select at least one accessible project before running this query."}
            )
        if len(project_ids) != len(project_slugs):
            raise InvestigationValidationError({"detail": "Invalid project scope."})

        snapshot, fingerprint = build_query_execution_snapshot(
            cell=locked, project_ids=project_ids, project_slugs=project_slugs
        )
        current = locked.current_execution
        if (
            current is not None
            and current.cell_version == locked.version
            and current.input_fingerprint == fingerprint
            and current.status
            in {
                InvestigationCellExecutionStatus.PENDING,
                InvestigationCellExecutionStatus.RUNNING,
            }
        ):
            return current, False

        dataset_hint = snapshot.get("datasetHint")
        if dataset_hint is not None and dataset_hint not in {
            "errors",
            "issues",
            "spans",
            "logs",
            "metrics",
        }:
            raise InvestigationValidationError({"detail": "The template dataset hint is invalid."})
        execution = InvestigationCellExecution.objects.create(
            cell=locked,
            triggered_by_id=user_id,
            executor=(
                InvestigationCellExecutor.ASSISTED_QUERY
                if dataset_hint is not None
                else InvestigationCellExecutor.CODE_MODE
            ),
            status=InvestigationCellExecutionStatus.PENDING,
            cell_version=locked.version,
            input_snapshot=snapshot,
            input_fingerprint=fingerprint,
            result_schema_version=1,
        )
        locked.current_execution = execution
        locked.save(update_fields=["current_execution", "date_updated"])
        return execution, True


def mark_query_execution_dispatched(
    execution: InvestigationCellExecution, *, seer_run_id: int
) -> None:
    InvestigationCellExecution.objects.filter(
        id=execution.id, status=InvestigationCellExecutionStatus.PENDING
    ).update(
        seer_run_id=seer_run_id,
        status=InvestigationCellExecutionStatus.RUNNING,
        started_at=timezone.now(),
    )


def mark_query_execution_dispatch_failed(
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
