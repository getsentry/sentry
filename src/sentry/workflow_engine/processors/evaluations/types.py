from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
    from sentry.workflow_engine.processors.evaluations.workflow import WorkflowEvaluationBatch

type WorkflowEngineResult = ProcessDetectorsResult | WorkflowEvaluationBatch
