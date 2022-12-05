from typing import Callable, Optional, Sequence, Union

from snuba_sdk import Column, Function

from sentry.exceptions import InvalidSearchQuery
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
)
from sentry.search.events import constants
from sentry.search.events.types import SelectType
from sentry.sentry_metrics.configuration import UseCaseKey


def resolve_project_threshold_config(
    tag_value_resolver: Callable[
        [Optional[UseCaseKey], int, Sequence[int]], Optional[Union[int, str]]
    ],
    column_name_resolver: Callable[[Optional[UseCaseKey], int, Sequence[int]], str],
    project_ids: Sequence[int],
    org_id: int,
    use_case_id: Optional[UseCaseKey] = None,
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

        transaction_id = tag_value_resolver(use_case_id, org_id, transaction)
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
                Column(name=column_name_resolver(use_case_id, org_id, "transaction")),
            ),
        ],
        constants.PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    )

    def _project_threshold_config(alias=None):
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
