from dataclasses import dataclass
from typing import Callable, Mapping, Optional, Union

import sentry_sdk
from django.utils.functional import cached_property
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from snuba_sdk.column import Column
from snuba_sdk.function import Function

from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Project, ProjectTeam
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
)
from sentry.search.events.constants import (
    ALIAS_PATTERN,
    ARRAY_FIELDS,
    DEFAULT_PROJECT_THRESHOLD,
    DEFAULT_PROJECT_THRESHOLD_METRIC,
    DURATION_PATTERN,
    ERROR_UNHANDLED_ALIAS,
    FUNCTION_ALIASES,
    FUNCTION_PATTERN,
    ISSUE_ALIAS,
    ISSUE_ID_ALIAS,
    MAX_QUERYABLE_TRANSACTION_THRESHOLDS,
    MEASUREMENTS_FRAMES_FROZEN_RATE,
    MEASUREMENTS_FRAMES_SLOW_RATE,
    MEASUREMENTS_STALL_PERCENTAGE,
    PROJECT_ALIAS,
    PROJECT_NAME_ALIAS,
    PROJECT_THRESHOLD_CONFIG_ALIAS,
    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    RESULT_TYPES,
    SEARCH_MAP,
    TAG_KEY_RE,
    TEAM_KEY_TRANSACTION_ALIAS,
    TIMESTAMP_TO_DAY_ALIAS,
    TIMESTAMP_TO_HOUR_ALIAS,
    USER_DISPLAY_ALIAS,
    VALID_FIELD_PATTERN,
)
from sentry.search.events.types import ParamsType, SelectType
from sentry.snuba.dataset import Dataset
from sentry.utils.numbers import format_grouped_length
from sentry.utils.snuba import resolve_column

from .fields import (
    ColumnArg,
    ColumnTagArg,
    ConditionArg,
    FunctionAliasArg,
    IntervalDefault,
    NullableNumberRange,
    NullColumn,
    NumberRange,
    NumericColumn,
    SnQLArrayCombinator,
    SnQLDateArg,
    SnQLFieldColumn,
    SnQLFunction,
    SnQLStringArg,
    StringArrayColumn,
    normalize_count_if_value,
    normalize_percentile_alias,
    reflective_result_type,
    with_default,
)

MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS = 500
MAX_QUERYABLE_TRANSACTION_THRESHOLDS = 500

# class DatasetConfig:
#     """
#     Dataset-specific configuration that is passed to
#     the QueryBuilder
#     """

#     def __init__(
#         self,
#         dataset: Dataset,
#         function_converter: Mapping[str, SnQLFunction],
#         field_alias_converter: Mapping[str, Callable[[str], SelectType]],
#     ):
#         self.dataset: dataset
#         self.function_converter: function_converter
#         self.field_alias_converter: field_alias_converter


class DiscoverDatasetConfig:
    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        column: Callable,
    ):
        self.resolve_column_name = resolve_column(dataset)
        self.dataset = dataset
        self.params = params
        self.column = column

    def field_alias_converter(self):
        return {
            # NOTE: `ISSUE_ALIAS` simply maps to the id, meaning that post processing
            # is required to insert the true issue short id into the response.
            ISSUE_ALIAS: self._resolve_issue_id_alias,
            PROJECT_ALIAS: self._resolve_project_slug_alias,
            PROJECT_THRESHOLD_CONFIG_ALIAS: lambda _: self._resolve_project_threshold_config,
            TEAM_KEY_TRANSACTION_ALIAS: self._resolve_team_key_transaction_alias,
        }

    def function_converter(self):
        return [
            SnQLFunction(
                "failure_count",
                snql_aggregate=lambda _, alias: Function(
                    "countIf",
                    [
                        Function(
                            "notIn",
                            [
                                self.column("transaction.status"),
                                (
                                    SPAN_STATUS_NAME_TO_CODE["ok"],
                                    SPAN_STATUS_NAME_TO_CODE["cancelled"],
                                    SPAN_STATUS_NAME_TO_CODE["unknown"],
                                ),
                            ],
                        )
                    ],
                    alias,
                ),
                default_result_type="integer",
            ),
            SnQLFunction(
                "apdex",
                optional_args=[NullableNumberRange("satisfaction", 0, None)],
                snql_aggregate=self._resolve_apdex_function,
                default_result_type="number",
            ),
        ]

    def _resolve_issue_id_alias(self, _: str) -> SelectType:
        """The state of having no issues is represented differently on transactions vs
        other events. On the transactions table, it is represented by 0 whereas it is
        represented by NULL everywhere else. We use coalesce here so we can treat this
        consistently
        """
        return Function("coalesce", [self.column("issue.id"), 0], ISSUE_ID_ALIAS)

    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        project_ids = {
            project_id
            for project_id in self.params.get("project_id", [])
            if isinstance(project_id, int)
        }

        # TODO: Try to reduce the size of the transform by using any existing conditions on projects
        # Do not optimize projects list if conditions contain OR operator

        projects = Project.objects.filter(id__in=project_ids).values("slug", "id")

        return Function(
            "transform",
            [
                self.column("project.id"),
                [project["id"] for project in projects],
                [project["slug"] for project in projects],
                "",
            ],
            alias,
        )

    @cached_property
    def _resolve_project_threshold_config(self) -> SelectType:
        org_id = self.params.get("organization_id")
        project_ids = self.params.get("project_id")

        project_threshold_configs = (
            ProjectTransactionThreshold.objects.filter(
                organization_id=org_id,
                project_id__in=project_ids,
            )
            .order_by("project_id")
            .values_list("project_id", "threshold", "metric")
        )

        transaction_threshold_configs = (
            ProjectTransactionThresholdOverride.objects.filter(
                organization_id=org_id,
                project_id__in=project_ids,
            )
            .order_by("project_id")
            .values_list("transaction", "project_id", "threshold", "metric")
        )

        num_project_thresholds = project_threshold_configs.count()
        sentry_sdk.set_tag("project_threshold.count", num_project_thresholds)
        sentry_sdk.set_tag(
            "project_threshold.count.grouped",
            format_grouped_length(num_project_thresholds, [10, 100, 250, 500]),
        )

        num_transaction_thresholds = transaction_threshold_configs.count()
        sentry_sdk.set_tag("txn_threshold.count", num_transaction_thresholds)
        sentry_sdk.set_tag(
            "txn_threshold.count.grouped",
            format_grouped_length(num_transaction_thresholds, [10, 100, 250, 500]),
        )

        if (
            num_project_thresholds + num_transaction_thresholds
            > MAX_QUERYABLE_TRANSACTION_THRESHOLDS
        ):
            raise InvalidSearchQuery(
                f"Exceeded {MAX_QUERYABLE_TRANSACTION_THRESHOLDS} configured transaction thresholds limit, try with fewer Projects."
            )

        # Arrays need to have toUint64 casting because clickhouse will define the type as the narrowest possible type
        # that can store listed argument types, which means the comparison will fail because of mismatched types
        project_threshold_config_keys = []
        project_threshold_config_values = []
        for project_id, threshold, metric in project_threshold_configs:
            project_threshold_config_keys.append(Function("toUInt64", [project_id]))
            project_threshold_config_values.append((TRANSACTION_METRICS[metric], threshold))

        project_threshold_override_config_keys = []
        project_threshold_override_config_values = []
        for transaction, project_id, threshold, metric in transaction_threshold_configs:
            project_threshold_override_config_keys.append(
                (Function("toUInt64", [project_id]), transaction)
            )
            project_threshold_override_config_values.append(
                (TRANSACTION_METRICS[metric], threshold)
            )

        project_threshold_config_index: SelectType = Function(
            "indexOf",
            [
                project_threshold_config_keys,
                self.column("project_id"),
            ],
            PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
        )

        project_threshold_override_config_index: SelectType = Function(
            "indexOf",
            [
                project_threshold_override_config_keys,
                (self.column("project_id"), self.column("transaction")),
            ],
            PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
        )

        def _project_threshold_config(alias: Optional[str] = None) -> SelectType:
            return (
                Function(
                    "if",
                    [
                        Function(
                            "equals",
                            [
                                project_threshold_config_index,
                                0,
                            ],
                        ),
                        (DEFAULT_PROJECT_THRESHOLD_METRIC, DEFAULT_PROJECT_THRESHOLD),
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
                if project_threshold_configs
                else Function(
                    "tuple",
                    [DEFAULT_PROJECT_THRESHOLD_METRIC, DEFAULT_PROJECT_THRESHOLD],
                    alias,
                )
            )

        if transaction_threshold_configs:
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
                PROJECT_THRESHOLD_CONFIG_ALIAS,
            )

        return _project_threshold_config(PROJECT_THRESHOLD_CONFIG_ALIAS)

    def _resolve_team_key_transaction_alias(self, _: str) -> SelectType:
        org_id = self.params.get("organization_id")
        project_ids = self.params.get("project_id")
        team_ids = self.params.get("team_id")

        if org_id is None or team_ids is None or project_ids is None:
            raise TypeError("Team key transactions parameters cannot be None")

        team_key_transactions = list(
            TeamKeyTransaction.objects.filter(
                organization_id=org_id,
                project_team__in=ProjectTeam.objects.filter(
                    project_id__in=project_ids, team_id__in=team_ids
                ),
            )
            .order_by("transaction", "project_team__project_id")
            .values_list("project_team__project_id", "transaction")
            .distinct("transaction", "project_team__project_id")[
                :MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS
            ]
        )

        count = len(team_key_transactions)

        # NOTE: this raw count is not 100% accurate because if it exceeds
        # `MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS`, it will not be reflected
        sentry_sdk.set_tag("team_key_txns.count", count)
        sentry_sdk.set_tag(
            "team_key_txns.count.grouped", format_grouped_length(count, [10, 100, 250, 500])
        )

        if count == 0:
            return Function("toInt8", [0], TEAM_KEY_TRANSACTION_ALIAS)

        return Function(
            "in",
            [(self.column("project_id"), self.column("transaction")), team_key_transactions],
            TEAM_KEY_TRANSACTION_ALIAS,
        )

    def _project_threshold_multi_if_function(self) -> SelectType:
        """Accessed by `_resolve_apdex_function` and `_resolve_count_miserable_function`,
        this returns the right duration value (for example, lcp or duration) based
        on project or transaction thresholds that have been configured by the user.
        """

        return Function(
            "multiIf",
            [
                Function(
                    "equals",
                    [
                        Function(
                            "tupleElement",
                            [self.resolve_field_alias("project_threshold_config"), 1],
                        ),
                        "lcp",
                    ],
                ),
                self.column("measurements.lcp"),
                self.column("transaction.duration"),
            ],
        )

    def _resolve_apdex_function(self, args: Mapping[str, str], alias: str) -> SelectType:
        if args["satisfaction"]:
            function_args = [self.column("transaction.duration"), int(args["satisfaction"])]
        else:
            function_args = [
                self._project_threshold_multi_if_function(),
                Function("tupleElement", [self.resolve_field_alias("project_threshold_config"), 2]),
            ]

        return Function("apdex", function_args, alias)
