from typing import Sequence, TypedDict

from sentry.workflow_engine.processors.evaluations import (
    BaseWorkflowEngineEvaluation,
    DataConditionGroupEvaluation,
)
from sentry.workflow_engine.types import WorkflowEvaluationResult, WorkflowEventData


class WorkflowEvaluationData(TypedDict):
    """
    Track all of the data that went into evaluating the workflow.

    # TODO - Should this also include the DetectorWorkflow information?

    `trigger_group_eval`: The evaluation of the conditions for triggering a workflow.
    `filter_group_evals`: All of the condition groups that determine if an action should be triggered.
    `event`: The data that started the workflow's evaluation.
    """

    trigger_group_eval: DataConditionGroupEvaluation
    filter_group_evals: Sequence[DataConditionGroupEvaluation]
    event: WorkflowEventData


class WorkflowEvaluation(
    BaseWorkflowEngineEvaluation[
        WorkflowEvaluationResult,
        WorkflowEvaluationData,
    ]
):
    """
    Stores the evaluation of a workflow.

    Inherited Properties
    - `result`: The actions that are triggered from the workflow, or if there
        are deferred conditions to batch evaluate.
    - `data`: WorkflowEvaluationData
    """

    pass
