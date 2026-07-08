from dataclasses import dataclass


@dataclass(frozen=True, kw_only=True)
class BaseWorkflowEngineEvaluation[R, E]:
    """
    This is a shared base class for all Evaluation classes.
    """

    result: R | None
    error: E | None
