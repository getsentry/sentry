from typing import Optional

from snuba_sdk import Column, Condition, Timeseries
from snuba_sdk.conditions import BooleanCondition, ConditionGroup
from snuba_sdk.mql.mql import parse_mql

from sentry.sentry_metrics.querying.api import InvalidMetricsQueryError


def transform_to_tags(conditions: Optional[ConditionGroup]) -> Optional[ConditionGroup]:
    """
    Transforms all the conditions to work on tags, by wrapping each `Column` name with 'tags[x]'.

    This function assumes that the query of a metric only refers to tags, since it can't be inferred that it's not
    referring to tags by just looking at the string. The values that are not tags, are specific to the data layer.
    """
    if conditions is None:
        return None

    transformed_conditions = []
    for condition in conditions:
        if isinstance(condition, BooleanCondition):
            transformed_conditions.append(
                BooleanCondition(
                    op=condition.op, conditions=transform_to_tags(condition.conditions)
                )
            )
        elif isinstance(condition, Condition) and isinstance(condition.lhs, Column):
            # We assume that all incoming conditions are on tags, since we do not allow filtering by project in the
            # query filters.
            tag_column = f"tags[{condition.lhs.name}]"
            transformed_conditions.append(
                Condition(lhs=Column(name=tag_column), op=condition.op, rhs=condition.rhs)
            )

    return transformed_conditions


def get_snuba_conditions_from_query(query: str) -> Optional[ConditionGroup]:
    """
    Returns a set of Snuba conditions from a query string which is assumed to contain filters in the MQL grammar.

    Since MQL does not support parsing only filters, we have to create a phantom query to feed the parser,
    in order for it to correctly resolve a `Timeseries` out of which we extract the `filters`.
    """
    # We want to create a phantom query to feed into the parser in order to be able to extract the conditions
    # from the returned timeseries.
    phantom_query = f"count(phantom){{{query}}}"

    parsed_phantom_query = parse_mql(phantom_query).query
    if not isinstance(parsed_phantom_query, Timeseries):
        # For now, we reuse data from `api` but we will soon lift out common components from that file.
        raise InvalidMetricsQueryError("The supplied query is not valid")

    return transform_to_tags(parsed_phantom_query.filters)
