from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from django.db import router, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from sentry.investigations.contracts import validate_query_result
from sentry.investigations.models import (
    InvestigationCell,
    InvestigationCellExecution,
    InvestigationCellExecutionProject,
    InvestigationCellExecutionStatus,
)
from sentry.models.project import Project
from sentry.seer.agent.types import FeatureRunStatus
from sentry.utils import metrics

logger = logging.getLogger(__name__)

INVESTIGATION_QUERY_FEATURE_ID = "investigation_query_cell"


def _incr(outcome: str) -> None:
    metrics.incr("investigations.query_execution.delivery", tags={"outcome": outcome})


def deliver_investigation_query_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> None:
    database = router.db_for_write(InvestigationCellExecution)
    with transaction.atomic(using=database):
        execution = (
            InvestigationCellExecution.objects.select_for_update()
            .select_related("cell__investigation", "seer_run")
            .filter(
                seer_run__uuid=run_uuid,
                cell__investigation__organization_id=organization_id,
            )
            .first()
        )
        if execution is None:
            _incr("missing_execution")
            logger.warning(
                "investigations.query_execution.missing_execution",
                extra={"organization_id": organization_id, "run_uuid": run_uuid},
            )
            return
        if execution.status in {
            InvestigationCellExecutionStatus.COMPLETED,
            InvestigationCellExecutionStatus.FAILED,
            InvestigationCellExecutionStatus.CANCELLED,
        }:
            _incr("duplicate")
            return

        if status == "error" or result is None:
            execution.status = InvestigationCellExecutionStatus.FAILED
            execution.error = {
                "code": "seer_execution_failed",
                "message": (error or "The query execution failed.")[:1000],
            }
            execution.completed_at = timezone.now()
            execution.save(update_fields=["status", "error", "completed_at", "date_updated"])
            _incr("failed")
            return

        try:
            validated = validate_query_result(result)
        except ValidationError as validation_error:
            execution.status = InvestigationCellExecutionStatus.FAILED
            execution.error = {
                "code": "invalid_result_contract",
                "message": str(validation_error.detail)[:1000],
            }
            execution.completed_at = timezone.now()
            execution.save(update_fields=["status", "error", "completed_at", "date_updated"])
            _incr("invalid_contract")
            return

        provenance = set(validated.get("dataProjectIds", []))
        allowed_scope = set(execution.input_snapshot.get("projectIds", []))
        projects = list(
            Project.objects.filter(id__in=provenance, organization_id=organization_id).order_by(
                "id"
            )
        )
        if provenance - allowed_scope or {project.id for project in projects} != provenance:
            execution.status = InvestigationCellExecutionStatus.FAILED
            execution.error = {
                "code": "invalid_project_provenance",
                "message": "The result referenced data outside its execution project scope.",
            }
            execution.completed_at = timezone.now()
            execution.save(update_fields=["status", "error", "completed_at", "date_updated"])
            _incr("invalid_provenance")
            return

        execution.result = validated
        execution.result_schema_version = validated["schemaVersion"]
        execution.status = InvestigationCellExecutionStatus.COMPLETED
        execution.error = None
        execution.completed_at = timezone.now()
        execution.save(
            update_fields=[
                "result",
                "result_schema_version",
                "status",
                "error",
                "completed_at",
                "date_updated",
            ]
        )
        InvestigationCellExecutionProject.objects.bulk_create(
            [
                InvestigationCellExecutionProject(execution=execution, project=project)
                for project in projects
            ],
            ignore_conflicts=True,
        )

        cell = InvestigationCell.objects.select_for_update().get(id=execution.cell_id)
        if cell.current_execution_id == execution.id and cell.version == execution.cell_version:
            cell.stale_at = None
            cell.save(update_fields=["stale_at", "date_updated"])
            _incr("completed")
        else:
            _incr("stale_completion")
