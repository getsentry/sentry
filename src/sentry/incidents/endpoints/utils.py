from sentry.workflow_engine.models.data_condition import Condition

data_condition_type_translators = {
    Condition.GREATER.value: lambda threshold: threshold - 100,
    Condition.GREATER_OR_EQUAL.value: lambda threshold: threshold - 100,
    Condition.LESS.value: lambda threshold: 100 - threshold,
    Condition.LESS_OR_EQUAL.value: lambda threshold: 100 - threshold,
}


def translate_data_condition_type(
    comparison_delta: int | None, condition_type: str, threshold: float | int | None
) -> float | None:
    """
    Translates our internal percent representation into a delta percentage.
    For ABOVE: A percentage like 170% would become 70% increase
    For BELOW: A percentage like 40% would become 60% decrease.
    """
    if threshold is None:
        return threshold

    if comparison_delta is None:
        return float(threshold)

    return data_condition_type_translators[condition_type](threshold)
