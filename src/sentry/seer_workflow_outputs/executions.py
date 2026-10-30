from __future__ import annotations

from sentry.investigations.models import (
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.seer.models.workflow import SeerWorkflowRunExecution, WorkflowRunError
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle

TERMINAL_INVESTIGATION_STATUSES = frozenset(
    {
        InvestigationOrchestrationStatus.COMPLETED,
        InvestigationOrchestrationStatus.FAILED,
        InvestigationOrchestrationStatus.CANCELLED,
    }
)


def finish_execution_if_outputs_done(
    execution: SeerWorkflowRunExecution, *, organization_id: int
) -> None:
    """Complete the execution once every investigation it is linked to has finished."""
    statuses = set(
        InvestigationOrchestrationRun.objects.filter(
            investigation__workflow_output_links__execution_id=execution.id
        ).values_list("status", flat=True)
    )
    if not statuses <= TERMINAL_INVESTIGATION_STATUSES:
        return
    error = None
    if InvestigationOrchestrationStatus.FAILED in statuses:
        error = WorkflowRunError(
            code="investigation_failed", message="The investigation did not finish."
        )
    elif InvestigationOrchestrationStatus.CANCELLED in statuses:
        error = WorkflowRunError(
            code="investigation_cancelled", message="The investigation was cancelled."
        )
    SeerWorkflowRunLifecycle(
        run_id=execution.run_id, organization_id=organization_id
    ).complete_execution(execution.id, error=error)
