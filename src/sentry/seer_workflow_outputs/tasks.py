from __future__ import annotations

import logging

from sentry.seer.models.workflow import SeerWorkflowExecutionStatus, SeerWorkflowRunExecution
from sentry.seer.workflows.runs import InvalidWorkflowTransition
from sentry.seer_workflow_outputs.executions import finish_execution_if_outputs_done
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.seer_workflow_outputs.tasks.finish_investigation_executions",
    namespace=seer_tasks,
)
def finish_investigation_executions(*, investigation_id: int) -> None:
    executions = SeerWorkflowRunExecution.objects.filter(
        output_links__notebook_id=investigation_id,
        status=SeerWorkflowExecutionStatus.RUNNING,
    ).select_related("run")
    for execution in executions:
        try:
            finish_execution_if_outputs_done(
                execution, organization_id=execution.run.organization_id
            )
        except InvalidWorkflowTransition:
            logger.info(
                "seer.workflow.execution_completion_conflict",
                extra={"execution_id": execution.id, "investigation_id": investigation_id},
            )
