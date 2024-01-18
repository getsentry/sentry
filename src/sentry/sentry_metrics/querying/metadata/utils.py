from typing import Callable, Mapping, Optional, Sequence

from snuba_sdk import Column, Condition, Timeseries
from snuba_sdk.conditions import BooleanCondition, BooleanOp, ConditionGroup, Op
from snuba_sdk.mql.mql import parse_mql

from sentry.models.environment import Environment
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError


def _visit_conditions(
    conditions: ConditionGroup, block: Callable[[Condition], Optional[ConditionGroup]]
) -> ConditionGroup:
    """
    Traverses a group of conditions, applies a function on each terminal condition and returns a transformed group.
    """
    transformed_conditions = []
    for condition in conditions:
        if isinstance(condition, BooleanCondition):
            transformed_conditions.append(
                BooleanCondition(
                    op=condition.op,
                    conditions=_visit_conditions(condition.conditions, block),
                )
            )
        elif isinstance(condition, Condition):
            if (conditions_to_replace := block(condition)) is not None:
                transformed_conditions += conditions_to_replace
            else:
                transformed_conditions.append(condition)

    return transformed_conditions


def transform_conditions_to_tags(
    conditions: Optional[ConditionGroup], check_sentry_tags: bool = False
) -> Optional[ConditionGroup]:
    """
    Transforms all the conditions to work on tags, by wrapping each `Column` name with 'tags[x]' and `sentry_tags[x]`.

    This function assumes that the query of a metric only refers to tags, since it can't be inferred that it's not
    referring to tags by just looking at the string. The values that are not tags, are specific to the data layer.
    """
    if conditions is None:
        return None

    def _transform_to_tags(condition: Condition) -> Optional[ConditionGroup]:
        if not isinstance(condition.lhs, Column):
            return None

        # We assume that all incoming conditions are on tags, since we do not allow filtering by project in the
        # query filters.
        tag_column = f"tags[{condition.lhs.name}]"
        sentry_tag_column = f"sentry_tags[{condition.lhs.name}]"

        if check_sentry_tags:
            tag_column = f"tags[{condition.lhs.name}]"
            # We might have tags across multiple nested structures such as `tags` and `sentry_tags` for this reason
            # we want to emit a condition that spans both.
            return [
                BooleanCondition(
                    op=BooleanOp.OR,
                    conditions=[
                        Condition(lhs=Column(name=tag_column), op=condition.op, rhs=condition.rhs),
                        Condition(
                            lhs=Column(name=sentry_tag_column),
                            op=condition.op,
                            rhs=condition.rhs,
                        ),
                    ],
                )
            ]
        else:
            return [Condition(lhs=Column(name=tag_column), op=condition.op, rhs=condition.rhs)]

    return _visit_conditions(conditions, _transform_to_tags)


def transform_conditions_with(
    conditions: Optional[ConditionGroup], mappings: Optional[Mapping[str, str]] = None
) -> Optional[ConditionGroup]:
    """
    Maps all the `Column`(s) whose `key` matches one of the supplied mappings. If found, replaces it with the mapped
    value.
    """
    if conditions is None:
        return None

    if not mappings:
        return conditions

    def _transform_conditions_with(condition: Condition) -> Optional[ConditionGroup]:
        if not isinstance(condition.lhs, Column):
            return None

        return [
            Condition(
                lhs=Column(name=mappings.get(condition.lhs.key, condition.lhs.name)),
                op=condition.op,
                rhs=condition.rhs,
            )
        ]

    return _visit_conditions(conditions, _transform_conditions_with)


def add_environments_condition(
    conditions: Optional[ConditionGroup], environments: Sequence[Environment]
) -> Optional[ConditionGroup]:
    """
    Adds the environment filter inside a condition group in the form (environment_condition AND existing_conditions).
    """
    if not environments:
        return conditions

    environments_names = [environment.name for environment in environments]
    return [Condition(Column("environment"), Op.IN, environments_names)] + (conditions or [])


def get_snuba_conditions_from_query(query: Optional[str]) -> Optional[ConditionGroup]:
    """
    Returns a set of Snuba conditions from a query string which is assumed to contain filters in the MQL grammar.

    Since MQL does not support parsing only filters, we have to create a phantom query to feed the parser,
    in order for it to correctly resolve a `Timeseries` out of which we extract the `filters`.
    """
    if not query:
        return None

    # We want to create a phantom query to feed into the parser in order to be able to extract the conditions
    # from the returned timeseries.
    phantom_query = f"count(phantom){{{query}}}"

    parsed_phantom_query = parse_mql(phantom_query).query
    if not isinstance(parsed_phantom_query, Timeseries):
        # For now, we reuse data from `api` but we will soon lift out common components from that file.
        raise InvalidMetricsQueryError("The supplied query is not valid")

    return parsed_phantom_query.filters
