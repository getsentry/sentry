from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.workflow_engine.processors.delayed_workflow import (
        DelayedWorkflowEvaluationResult,
    )
    from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
    from sentry.workflow_engine.processors.evaluations.workflow import ProcessWorkflowsResult

type WorkflowEngineResult = (
    ProcessDetectorsResult | ProcessWorkflowsResult | DelayedWorkflowEvaluationResult
)
