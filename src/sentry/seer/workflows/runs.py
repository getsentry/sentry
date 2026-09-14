from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal

from django.db import router, transaction
from django.utils import timezone

from sentry.seer.models.run import SeerRun
from sentry.seer.models.workflow import (
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
)


def complete_workflow_dispatch(run_id: int, *, organization_id: int) -> None:
    with transaction.atomic(router.db_for_write(SeerWorkflowRun)):
        run = SeerWorkflowRun.objects.select_for_update().get(
            id=run_id, organization_id=organization_id
        )
        if run.date_dispatched is not None:
            return
        extras = dict(run.extras)
        extras.pop("error_message", None)
        extras.pop("error_type", None)
        run.update(date_dispatched=timezone.now(), extras=extras)
        _update_workflow_status(run)


def fail_workflow_execution_for_run(run: SeerRun, error: str) -> None:
    execution_id = (
        SeerWorkflowRunExecution.objects.filter(
            seer_run=run, run__organization_id=run.organization_id
        )
        .values_list("id", flat=True)
        .first()
    )
    if execution_id is not None:
        finish_workflow_execution(
            execution_id,
            organization_id=run.organization_id,
            status=SeerWorkflowRunStatus.FAILED,
            error=error,
        )


def finish_workflow_execution(
    execution_id: int,
    *,
    organization_id: int,
    status: Literal[
        SeerWorkflowRunStatus.COMPLETE, SeerWorkflowRunStatus.PARTIAL, SeerWorkflowRunStatus.FAILED
    ],
    error: str | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> None:
    with transaction.atomic(router.db_for_write(SeerWorkflowRunExecution)):
        execution = SeerWorkflowRunExecution.objects.select_for_update(of=("self",)).get(
            id=execution_id, run__organization_id=organization_id
        )
        # Successful results survive late failures and duplicate deliveries. Failed
        # executions may recover if Seer subsequently delivers a valid result.
        if execution.status == status or execution.status in (
            SeerWorkflowRunStatus.COMPLETE,
            SeerWorkflowRunStatus.PARTIAL,
        ):
            return
        run = SeerWorkflowRun.objects.select_for_update().get(
            id=execution.run_id, organization_id=organization_id
        )
        extras = {**execution.extras, **(metadata or {})}
        if error is not None:
            extras["error_message"] = error
        else:
            extras.pop("error_message", None)
            extras.pop("error_type", None)
        execution.update(status=status, date_completed=timezone.now(), extras=extras)
        _update_workflow_status(run)


def _update_workflow_status(run: SeerWorkflowRun) -> None:
    # Historical invocations have no reliable per-execution completion state.
    if run.status is None:
        return
    statuses = set(run.executions.values_list("status", flat=True))
    # An inline dispatch failure can prevent the caller from completing dispatch.
    if run.date_dispatched is None:
        if SeerWorkflowRunStatus.FAILED in statuses:
            run.update(status=SeerWorkflowRunStatus.FAILED, date_completed=timezone.now())
        return
    if None in statuses or SeerWorkflowRunStatus.RUNNING in statuses:
        run.update(status=SeerWorkflowRunStatus.RUNNING, date_completed=None)
        return
    if statuses == {SeerWorkflowRunStatus.FAILED}:
        status = SeerWorkflowRunStatus.FAILED
    elif SeerWorkflowRunStatus.FAILED in statuses or SeerWorkflowRunStatus.PARTIAL in statuses:
        status = SeerWorkflowRunStatus.PARTIAL
    else:
        status = SeerWorkflowRunStatus.COMPLETE
    run.update(status=status, date_completed=timezone.now())
