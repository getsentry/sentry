from sentry.workflow_engine.types import DataConditionResult


class DataConditionEvaluationException(Exception):
    pass


class DataConditionEvaluation:
    evaluation: bool
    result: DataConditionResult
