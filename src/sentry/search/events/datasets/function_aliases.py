from collections.abc import Callable, Mapping, Sequence
from typing import Any

from snuba_sdk import Column, Function

from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
)
from sentry.search.events import constants
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.types import SelectType
from sentry.utils.hashlib import fnv1a_32


def resolve_project_threshold_config(
    # See resolve_tag_value signature
    tag_value_resolver: Callable[[int, str], int | str | None],
    # See resolve_tag_key signature
    column_name_resolver: Callable[[int, str], str],
    project_ids: Sequence[int],
    org_id: int,
) -> SelectType:
    """
    Shared function that resolves the project threshold configuration used by both snuba/metrics
    and search/events/datasets.
    """

    project_threshold_configs = ProjectTransactionThreshold.filter(
        organization_id=org_id,
        project_ids=project_ids,
        order_by=["project_id"],
        value_list=["project_id", "metric"],
    )

    transaction_threshold_configs = ProjectTransactionThresholdOverride.filter(
        organization_id=org_id,
        project_ids=project_ids,
        order_by=["project_id"],
        value_list=["transaction", "project_id", "metric"],
    )

    num_project_thresholds = len(project_threshold_configs)
    num_transaction_thresholds = len(transaction_threshold_configs)

    if (
        num_project_thresholds + num_transaction_thresholds
        > constants.MAX_QUERYABLE_TRANSACTION_THRESHOLDS
    ):
        raise InvalidSearchQuery(
            f"Exceeded {constants.MAX_QUERYABLE_TRANSACTION_THRESHOLDS} configured transaction thresholds limit, try with fewer Projects."
        )

    # Arrays need to have toUint64 casting because clickhouse will define the type as the narrowest possible type
    # that can store listed argument types, which means the comparison will fail because of mismatched types
    project_thresholds = {}
    project_threshold_config_keys = []
    project_threshold_config_values = []
    for project_id, metric in project_threshold_configs:
        metric = TRANSACTION_METRICS[metric]
        if metric == constants.DEFAULT_PROJECT_THRESHOLD_METRIC:
            # small optimization, if the configuration is equal to the default,
            # we can skip it in the final query
            continue

        project_thresholds[project_id] = metric
        project_threshold_config_keys.append(Function("toUInt64", [project_id]))
        project_threshold_config_values.append(metric)

    project_threshold_override_config_keys = []
    project_threshold_override_config_values = []
    for transaction, project_id, metric in transaction_threshold_configs:
        metric = TRANSACTION_METRICS[metric]
        if project_id in project_thresholds and metric == project_thresholds[project_id][0]:
            # small optimization, if the configuration is equal to the project
            # configs, we can skip it in the final query
            continue

        elif (
            project_id not in project_thresholds
            and metric == constants.DEFAULT_PROJECT_THRESHOLD_METRIC
        ):
            # small optimization, if the configuration is equal to the default
            # and no project configs were set, we can skip it in the final query
            continue

        transaction_id = tag_value_resolver(org_id, transaction)
        # Don't add to the config if we can't resolve it
        if transaction_id is None:
            continue
        project_threshold_override_config_keys.append(
            (
                Function("toUInt64", [project_id]),
                transaction_id,
            )
        )
        project_threshold_override_config_values.append(metric)

    project_threshold_config_index: SelectType = Function(
        "indexOf",
        [
            project_threshold_config_keys,
            Column(name="project_id"),
        ],
        constants.PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    )

    project_threshold_override_config_index: SelectType = Function(
        "indexOf",
        [
            project_threshold_override_config_keys,
            (
                Column(name="project_id"),
                Column(name=column_name_resolver(org_id, "transaction")),
            ),
        ],
        constants.PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    )

    def _project_threshold_config(alias: str | None = None) -> SelectType:
        if project_threshold_config_keys and project_threshold_config_values:
            return Function(
                "if",
                [
                    Function(
                        "equals",
                        [
                            project_threshold_config_index,
                            0,
                        ],
                    ),
                    constants.DEFAULT_PROJECT_THRESHOLD_METRIC,
                    Function(
                        "arrayElement",
                        [
                            project_threshold_config_values,
                            project_threshold_config_index,
                        ],
                    ),
                ],
                alias,
            )

        return Function(
            "toString",
            [constants.DEFAULT_PROJECT_THRESHOLD_METRIC],
        )

    if project_threshold_override_config_keys and project_threshold_override_config_values:
        return Function(
            "if",
            [
                Function(
                    "equals",
                    [
                        project_threshold_override_config_index,
                        0,
                    ],
                ),
                _project_threshold_config(),
                Function(
                    "arrayElement",
                    [
                        project_threshold_override_config_values,
                        project_threshold_override_config_index,
                    ],
                ),
            ],
            constants.PROJECT_THRESHOLD_CONFIG_ALIAS,
        )

    return _project_threshold_config(constants.PROJECT_THRESHOLD_CONFIG_ALIAS)


def resolve_metrics_percentile(
    args: Mapping[str, str | Column | SelectType | int | float],
    alias: str | None,
    fixed_percentile: float | None = None,
    extra_conditions: list[Function] | None = None,
) -> SelectType:
    if fixed_percentile is None and isinstance(args["percentile"], float):
        fixed_percentile = args["percentile"]
    if fixed_percentile not in constants.METRIC_PERCENTILES:
        raise IncompatibleMetricsQuery("Custom quantile incompatible with metrics")

    conditions = [Function("equals", [Column("metric_id"), args["metric_id"]])]
    if extra_conditions is not None:
        conditions.extend(extra_conditions)

    if len(conditions) == 2:
        condition = Function("and", conditions)
    elif len(conditions) != 1:
        # Need to chain multiple and functions here to allow more than 2 conditions (ie. and(and(a, b), c))
        raise InvalidSearchQuery("Only 1 additional condition is currently available")
    else:
        condition = conditions[0]

    return (
        Function(
            "maxIf",
            [
                Column("value"),
                condition,
            ],
            alias,
        )
        if fixed_percentile == 1
        else Function(
            "arrayElement",
            [
                Function(
                    f"quantilesIf({fixed_percentile})",
                    [Column("value"), condition],
                ),
                1,
            ],
            alias,
        )
    )


def resolve_percent_change(
    first_value: SelectType, second_value: SelectType, alias: str | None = None
) -> SelectType:
    """(v2-v1)/abs(v1)"""
    return resolve_division(
        Function("minus", [second_value, first_value]),
        Function("abs", [first_value]),
        alias,
    )


def resolve_avg_compare_if(
    column_resolver: Callable[[str], Column],
    args: Mapping[str, str | Column | SelectType | int | float],
    value_key: str,
    alias: str | None,
) -> SelectType:
    """Helper function for avg compare"""
    if not isinstance(args["comparison_column"], str):
        raise InvalidSearchQuery(
            f"Invalid column type: expected <str> got {args['comparison_column']}"
        )
    return Function(
        "avgIf",
        [
            Column("value"),
            Function(
                "and",
                [
                    Function("equals", [Column("metric_id"), args["metric_id"]]),
                    Function(
                        "equals",
                        [column_resolver(args["comparison_column"]), args[value_key]],
                    ),
                ],
            ),
        ],
        f"{alias}__{value_key}",
    )


def resolve_avg_compare(
    column_resolver: Callable[[str], Column],
    args: Mapping[str, str | Column | SelectType | int | float],
    alias: str | None = None,
) -> SelectType:
    return resolve_percent_change(
        resolve_avg_compare_if(column_resolver, args, "first_value", alias),
        resolve_avg_compare_if(column_resolver, args, "second_value", alias),
        alias,
    )


def resolve_metrics_layer_percentile(
    args: Mapping[str, str | Column | SelectType | int | float],
    alias: str,
    resolve_mri: Callable[[str], Column],
    fixed_percentile: float | None = None,
) -> SelectType:
    # TODO: rename to just resolve_metrics_percentile once the non layer code can be retired
    if fixed_percentile is None and isinstance(args["percentile"], float):
        fixed_percentile = args["percentile"]
    if fixed_percentile not in constants.METRIC_PERCENTILES:
        raise IncompatibleMetricsQuery("Custom quantile incompatible with metrics")
    if not isinstance(args["column"], str):
        raise InvalidSearchQuery(f"Invalid column type: expected <str> got {args['column']}")
    column = resolve_mri(args["column"])
    return (
        Function(
            "max",
            [
                column,
            ],
            alias,
        )
        if fixed_percentile == 1
        else Function(
            f"p{int(fixed_percentile * 100)}",
            [
                column,
            ],
            alias,
        )
    )


def resolve_division(
    dividend: SelectType, divisor: SelectType, alias: str | None, fallback: Any | None = None
) -> SelectType:
    return Function(
        "if",
        [
            Function(
                "greater",
                [divisor, 0],
            ),
            Function(
                "divide",
                [
                    dividend,
                    divisor,
                ],
            ),
            fallback,
        ],
        alias,
    )


def resolve_rounded_timestamp(
    interval: int, alias: str, timestamp_column: str = "timestamp"
) -> SelectType:
    return Function(
        "toUInt32",
        [
            Function(
                "multiply",
                [
                    Function(
                        "intDiv",
                        [Function("toUInt32", [Column(timestamp_column)]), interval],
                    ),
                    interval,
                ],
            ),
        ],
        alias,
    )


def resolve_random_samples(
    columns: list[SelectType],
    alias: str,
    offset: int,
    limit: int,
    size: int = 1,
) -> SelectType:
    seed_str = f"{offset}-{limit}"
    seed = fnv1a_32(seed_str.encode("utf-8"))
    return Function(
        f"groupArraySample({size}, {seed})",
        [Function("tuple", columns)],
        alias,
    )


def resolve_eps(
    args: Mapping[str, str | Column | SelectType | int | float],
    alias: str,
    builder: BaseQueryBuilder,
) -> SelectType:
    if hasattr(builder, "interval"):
        interval = builder.interval
    else:
        interval = args["interval"]
    return Function("divide", [Function("count", []), interval], alias)


def resolve_epm(
    args: Mapping[str, str | Column | SelectType | int | float],
    alias: str,
    builder: BaseQueryBuilder,
) -> SelectType:
    if hasattr(builder, "interval"):
        interval = builder.interval
    else:
        interval = args["interval"]
    return Function(
        "divide",
        [Function("count", []), Function("divide", [interval, 60])],
        alias,
    )
