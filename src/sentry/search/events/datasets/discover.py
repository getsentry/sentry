from __future__ import annotations

from typing import Callable, List, Mapping, Optional, Union

import sentry_sdk
from django.utils.functional import cached_property
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.function import Function

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.discover.models import TeamKeyTransaction
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Environment, ProjectTeam, Release, SemverFilter
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
)
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import (
    DEFAULT_PROJECT_THRESHOLD,
    DEFAULT_PROJECT_THRESHOLD_METRIC,
    EQUALITY_OPERATORS,
    ERROR_HANDLED_ALIAS,
    ERROR_UNHANDLED_ALIAS,
    FUNCTION_ALIASES,
    ISSUE_ALIAS,
    ISSUE_ID_ALIAS,
    MAX_QUERYABLE_TRANSACTION_THRESHOLDS,
    MAX_SEARCH_RELEASES,
    MEASUREMENTS_FRAMES_FROZEN_RATE,
    MEASUREMENTS_FRAMES_SLOW_RATE,
    MEASUREMENTS_STALL_PERCENTAGE,
    OPERATOR_NEGATION_MAP,
    OPERATOR_TO_DJANGO,
    PROJECT_ALIAS,
    PROJECT_NAME_ALIAS,
    PROJECT_THRESHOLD_CONFIG_ALIAS,
    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_EMPTY_RELEASE,
    SEMVER_PACKAGE_ALIAS,
    TEAM_KEY_TRANSACTION_ALIAS,
    TIMESTAMP_TO_DAY_ALIAS,
    TIMESTAMP_TO_HOUR_ALIAS,
    TRANSACTION_STATUS_ALIAS,
    USER_DISPLAY_ALIAS,
)
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    MAX_QUERYABLE_TEAM_KEY_TRANSACTIONS,
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
from sentry.search.events.filter import (
    _flip_field_sort,
    handle_operator_negation,
    parse_semver,
    to_list,
    translate_transaction_status,
)
from sentry.search.events.types import SelectType, WhereType
from sentry.utils.numbers import format_grouped_length


class DiscoverDatasetConfig(DatasetConfig):
    custom_threshold_columns = {
        "apdex()",
        "count_miserable(user)",
        "user_misery()",
    }

    def __init__(self, builder: QueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {
            "environment": self.builder._environment_filter_converter,
            "message": self._message_filter_converter,
            PROJECT_ALIAS: self._project_slug_filter_converter,
            PROJECT_NAME_ALIAS: self._project_slug_filter_converter,
            ISSUE_ALIAS: self._issue_filter_converter,
            ISSUE_ID_ALIAS: self._issue_id_filter_converter,
            RELEASE_ALIAS: self._release_filter_converter,
            TRANSACTION_STATUS_ALIAS: self._transaction_status_filter_converter,
            ERROR_HANDLED_ALIAS: self._error_handled_filter_converter,
            ERROR_UNHANDLED_ALIAS: self._error_unhandled_filter_converter,
            TEAM_KEY_TRANSACTION_ALIAS: self._key_transaction_filter_converter,
            RELEASE_STAGE_ALIAS: self._release_stage_filter_converter,
            SEMVER_ALIAS: self._semver_filter_converter,
            SEMVER_PACKAGE_ALIAS: self._semver_package_filter_converter,
            SEMVER_BUILD_ALIAS: self._semver_build_filter_converter,
        }

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {
            PROJECT_ALIAS: self._resolve_project_slug_alias,
            PROJECT_NAME_ALIAS: self._resolve_project_slug_alias,
            # NOTE: `ISSUE_ALIAS` simply maps to the id, meaning that post processing
            # is required to insert the true issue short id into the response.
            ISSUE_ALIAS: self._resolve_issue_id_alias,
            ISSUE_ID_ALIAS: self._resolve_issue_id_alias,
            TIMESTAMP_TO_HOUR_ALIAS: self._resolve_timestamp_to_hour_alias,
            TIMESTAMP_TO_DAY_ALIAS: self._resolve_timestamp_to_day_alias,
            USER_DISPLAY_ALIAS: self._resolve_user_display_alias,
            PROJECT_THRESHOLD_CONFIG_ALIAS: lambda _: self._resolve_project_threshold_config,
            ERROR_UNHANDLED_ALIAS: self._resolve_error_unhandled_alias,
            TEAM_KEY_TRANSACTION_ALIAS: self._resolve_team_key_transaction_alias,
            MEASUREMENTS_FRAMES_SLOW_RATE: self._resolve_measurements_frames_slow_rate,
            MEASUREMENTS_FRAMES_FROZEN_RATE: self._resolve_measurements_frames_frozen_rate,
            MEASUREMENTS_STALL_PERCENTAGE: self._resolve_measurements_stall_percentage,
        }

    @property
    def function_converter(self) -> Mapping[str, SnQLFunction]:
        function_converter = {
            function.name: function
            for function in [
                SnQLFunction(
                    "failure_count",
                    snql_aggregate=lambda _, alias: Function(
                        "countIf",
                        [
                            Function(
                                "notIn",
                                [
                                    self.builder.column("transaction.status"),
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
                SnQLFunction(
                    "count_miserable",
                    required_args=[ColumnTagArg("column")],
                    optional_args=[NullableNumberRange("satisfaction", 0, None)],
                    calculated_args=[
                        {
                            "name": "tolerated",
                            "fn": lambda args: args["satisfaction"] * 4.0
                            if args["satisfaction"] is not None
                            else None,
                        }
                    ],
                    snql_aggregate=self._resolve_count_miserable_function,
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "user_misery",
                    # To correct for sensitivity to low counts, User Misery is modeled as a Beta Distribution Function.
                    # With prior expectations, we have picked the expected mean user misery to be 0.05 and variance
                    # to be 0.0004. This allows us to calculate the alpha (5.8875) and beta (111.8625) parameters,
                    # with the user misery being adjusted for each fast/slow unique transaction. See:
                    # https://stats.stackexchange.com/questions/47771/what-is-the-intuition-behind-beta-distribution
                    # for an intuitive explanation of the Beta Distribution Function.
                    optional_args=[
                        NullableNumberRange("satisfaction", 0, None),
                        with_default(5.8875, NumberRange("alpha", 0, None)),
                        with_default(111.8625, NumberRange("beta", 0, None)),
                    ],
                    calculated_args=[
                        {
                            "name": "tolerated",
                            "fn": lambda args: args["satisfaction"] * 4.0
                            if args["satisfaction"] is not None
                            else None,
                        },
                        {"name": "parameter_sum", "fn": lambda args: args["alpha"] + args["beta"]},
                    ],
                    snql_aggregate=self._resolve_user_misery_function,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "count",
                    optional_args=[NullColumn("column")],
                    snql_aggregate=lambda _, alias: Function(
                        "count",
                        [],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "last_seen",
                    snql_aggregate=lambda _, alias: Function(
                        "max",
                        [self.builder.column("timestamp")],
                        alias,
                    ),
                    default_result_type="date",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "latest_event",
                    snql_aggregate=lambda _, alias: Function(
                        "argMax",
                        [self.builder.column("id"), self.builder.column("timestamp")],
                        alias,
                    ),
                    default_result_type="string",
                ),
                SnQLFunction(
                    "failure_rate",
                    snql_aggregate=lambda _, alias: Function(
                        "failure_rate",
                        [],
                        alias,
                    ),
                    default_result_type="percentage",
                ),
                SnQLFunction(
                    "percentile",
                    required_args=[
                        NumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                    ],
                    snql_aggregate=self._resolve_percentile,
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                    combinators=[
                        SnQLArrayCombinator("column", NumericColumn.numeric_array_columns)
                    ],
                ),
                SnQLFunction(
                    "p50",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.5),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p75",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.75),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p95",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.95),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p99",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.99),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p100",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 1),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "to_other",
                    required_args=[
                        ColumnArg("column", allowed_columns=["release", "trace.parent_span"]),
                        SnQLStringArg("value", unquote=True, unescape_quotes=True),
                    ],
                    optional_args=[
                        with_default("that", SnQLStringArg("that")),
                        with_default("this", SnQLStringArg("this")),
                    ],
                    snql_column=lambda args, alias: Function(
                        "if",
                        [
                            Function("equals", [args["column"], args["value"]]),
                            args["this"],
                            args["that"],
                        ],
                        alias,
                    ),
                ),
                SnQLFunction(
                    "percentile_range",
                    required_args=[
                        NumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                        ConditionArg("condition"),
                        SnQLDateArg("middle"),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        f"quantileIf({args['percentile']:.2f})",
                        [
                            args["column"],
                            # This condition is written in this seemingly backwards way because of limitations
                            # in the json query syntax.
                            # TODO(snql-migration): Once the trends endpoint is using snql, we should update it
                            # and flip these conditions back
                            Function(
                                args["condition"],
                                [
                                    Function("toDateTime", [args["middle"]]),
                                    self.builder.column("timestamp"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "avg_range",
                    required_args=[
                        NumericColumn("column"),
                        ConditionArg("condition"),
                        SnQLDateArg("middle"),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "avgIf",
                        [
                            args["column"],
                            # see `percentile_range` for why this condition feels backwards
                            Function(
                                args["condition"],
                                [
                                    Function("toDateTime", [args["middle"]]),
                                    self.builder.column("timestamp"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "variance_range",
                    required_args=[
                        NumericColumn("column"),
                        ConditionArg("condition"),
                        SnQLDateArg("middle"),
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "varSampIf",
                        [
                            args["column"],
                            # see `percentile_range` for why this condition feels backwards
                            Function(
                                args["condition"],
                                [
                                    Function("toDateTime", [args["middle"]]),
                                    self.builder.column("timestamp"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="duration",
                ),
                SnQLFunction(
                    "count_range",
                    required_args=[ConditionArg("condition"), SnQLDateArg("middle")],
                    snql_aggregate=lambda args, alias: Function(
                        "countIf",
                        [
                            # see `percentile_range` for why this condition feels backwards
                            Function(
                                args["condition"],
                                [
                                    Function("toDateTime", [args["middle"]]),
                                    self.builder.column("timestamp"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_if",
                    required_args=[
                        ColumnTagArg("column"),
                        ConditionArg("condition"),
                        SnQLStringArg(
                            "value", unquote=True, unescape_quotes=True, optional_unquote=True
                        ),
                    ],
                    calculated_args=[
                        {
                            "name": "typed_value",
                            "fn": normalize_count_if_value,
                        }
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        "countIf",
                        [
                            Function(
                                args["condition"],
                                [
                                    args["column"],
                                    args["typed_value"],
                                ],
                            )
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_unique",
                    required_args=[ColumnTagArg("column")],
                    snql_aggregate=lambda args, alias: Function("uniq", [args["column"]], alias),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "count_at_least",
                    required_args=[NumericColumn("column"), NumberRange("threshold", 0, None)],
                    snql_aggregate=lambda args, alias: Function(
                        "countIf",
                        [Function("greaterOrEquals", [args["column"], args["threshold"]])],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "min",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "max",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("max", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                    combinators=[
                        SnQLArrayCombinator("column", NumericColumn.numeric_array_columns)
                    ],
                ),
                SnQLFunction(
                    "avg",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("avg", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "var",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("varSamp", [args["column"]], alias),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "stddev",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function(
                        "stddevSamp", [args["column"]], alias
                    ),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "cov",
                    required_args=[NumericColumn("column1"), NumericColumn("column2")],
                    snql_aggregate=lambda args, alias: Function(
                        "covarSamp", [args["column1"], args["column2"]], alias
                    ),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "corr",
                    required_args=[NumericColumn("column1"), NumericColumn("column2")],
                    snql_aggregate=lambda args, alias: Function(
                        "corr", [args["column1"], args["column2"]], alias
                    ),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "sum",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("sum", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    default_result_type="duration",
                    combinators=[
                        SnQLArrayCombinator("column", NumericColumn.numeric_array_columns)
                    ],
                ),
                SnQLFunction(
                    "any",
                    required_args=[SnQLFieldColumn("column")],
                    # Not actually using `any` so that this function returns consistent results
                    snql_aggregate=lambda args, alias: Function("min", [args["column"]], alias),
                    result_type_fn=reflective_result_type(),
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "eps",
                    snql_aggregate=lambda args, alias: Function(
                        "divide", [Function("count", []), args["interval"]], alias
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
                SnQLFunction(
                    "epm",
                    snql_aggregate=lambda args, alias: Function(
                        "divide",
                        [Function("count", []), Function("divide", [args["interval"], 60])],
                        alias,
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
                SnQLFunction(
                    "compare_numeric_aggregate",
                    required_args=[
                        FunctionAliasArg("aggregate_alias"),
                        ConditionArg("condition"),
                        NumberRange("value", 0, None),
                    ],
                    calculated_args=[
                        {
                            "name": "aggregate_function",
                            "fn": normalize_percentile_alias,
                        }
                    ],
                    snql_aggregate=lambda args, alias: Function(
                        args["condition"],
                        [self.builder.resolve_function(args["aggregate_function"]), args["value"]],
                        alias,
                    ),
                    default_result_type="number",
                ),
                SnQLFunction(
                    "array_join",
                    required_args=[StringArrayColumn("column")],
                    snql_column=lambda args, alias: Function("arrayJoin", [args["column"]], alias),
                    default_result_type="string",
                    private=True,
                ),
                SnQLFunction(
                    "absolute_correlation",
                    snql_aggregate=lambda _, alias: Function(
                        "abs",
                        [
                            Function(
                                "corr",
                                [
                                    Function("toUnixTimestamp", [self.builder.column("timestamp")]),
                                    self.builder.column("transaction.duration"),
                                ],
                            ),
                        ],
                        alias,
                    ),
                    default_result_type="number",
                ),
                SnQLFunction(
                    "histogram",
                    required_args=[
                        NumericColumn("column", allow_array_value=True),
                        # the bucket_size and start_offset should already be adjusted
                        # using the multiplier before it is passed here
                        NumberRange("bucket_size", 0, None),
                        NumberRange("start_offset", 0, None),
                        NumberRange("multiplier", 1, None),
                    ],
                    # floor((x * multiplier - start_offset) / bucket_size) * bucket_size + start_offset
                    snql_column=lambda args, alias: Function(
                        "plus",
                        [
                            Function(
                                "multiply",
                                [
                                    Function(
                                        "floor",
                                        [
                                            Function(
                                                "divide",
                                                [
                                                    Function(
                                                        "minus",
                                                        [
                                                            Function(
                                                                "multiply",
                                                                [
                                                                    args["column"],
                                                                    args["multiplier"],
                                                                ],
                                                            ),
                                                            args["start_offset"],
                                                        ],
                                                    ),
                                                    args["bucket_size"],
                                                ],
                                            ),
                                        ],
                                    ),
                                    args["bucket_size"],
                                ],
                            ),
                            args["start_offset"],
                        ],
                        alias,
                    ),
                    default_result_type="number",
                    private=True,
                ),
            ]
        }

        for alias, name in FUNCTION_ALIASES.items():
            function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    # Field Aliases
    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        project_ids = {
            project_id
            for project_id in self.builder.params.get("project_id", [])
            if isinstance(project_id, int)
        }

        # Try to reduce the size of the transform by using any existing conditions on projects
        # Do not optimize projects list if conditions contain OR operator
        if not self.builder.has_or_condition and len(self.builder.projects_to_filter) > 0:
            project_ids &= self.builder.projects_to_filter

        projects = Project.objects.filter(id__in=project_ids).values("slug", "id")

        return Function(
            "transform",
            [
                self.builder.column("project.id"),
                [project["id"] for project in projects],
                [project["slug"] for project in projects],
                "",
            ],
            alias,
        )

    def _resolve_issue_id_alias(self, _: str) -> SelectType:
        """The state of having no issues is represented differently on transactions vs
        other events. On the transactions table, it is represented by 0 whereas it is
        represented by NULL everywhere else. We use coalesce here so we can treat this
        consistently
        """
        return Function("coalesce", [self.builder.column("issue.id"), 0], ISSUE_ID_ALIAS)

    def _resolve_timestamp_to_hour_alias(self, _: str) -> SelectType:
        return Function(
            "toStartOfHour", [self.builder.column("timestamp")], TIMESTAMP_TO_HOUR_ALIAS
        )

    def _resolve_timestamp_to_day_alias(self, _: str) -> SelectType:
        return Function("toStartOfDay", [self.builder.column("timestamp")], TIMESTAMP_TO_DAY_ALIAS)

    def _resolve_user_display_alias(self, _: str) -> SelectType:
        columns = ["user.email", "user.username", "user.id", "user.ip"]
        return Function(
            "coalesce", [self.builder.column(column) for column in columns], USER_DISPLAY_ALIAS
        )

    @cached_property
    def _resolve_project_threshold_config(self) -> SelectType:
        org_id = self.builder.params.get("organization_id")
        project_ids = self.builder.params.get("project_id")

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
        project_thresholds = {}
        project_threshold_config_keys = []
        project_threshold_config_values = []
        for project_id, threshold, metric in project_threshold_configs:
            metric = TRANSACTION_METRICS[metric]
            if (
                threshold == DEFAULT_PROJECT_THRESHOLD
                and metric == DEFAULT_PROJECT_THRESHOLD_METRIC
            ):
                # small optimization, if the configuration is equal to the default,
                # we can skip it in the final query
                continue

            project_thresholds[project_id] = (metric, threshold)
            project_threshold_config_keys.append(Function("toUInt64", [project_id]))
            project_threshold_config_values.append((metric, threshold))

        project_threshold_override_config_keys = []
        project_threshold_override_config_values = []
        for transaction, project_id, threshold, metric in transaction_threshold_configs:
            metric = TRANSACTION_METRICS[metric]
            if (
                project_id in project_thresholds
                and threshold == project_thresholds[project_id][1]
                and metric == project_thresholds[project_id][0]
            ):
                # small optimization, if the configuration is equal to the project
                # configs, we can skip it in the final query
                continue

            elif (
                project_id not in project_thresholds
                and threshold == DEFAULT_PROJECT_THRESHOLD
                and metric == DEFAULT_PROJECT_THRESHOLD_METRIC
            ):
                # small optimization, if the configuration is equal to the default
                # and no project configs were set, we can skip it in the final query
                continue

            project_threshold_override_config_keys.append(
                (Function("toUInt64", [project_id]), transaction)
            )
            project_threshold_override_config_values.append((metric, threshold))

        project_threshold_config_index: SelectType = Function(
            "indexOf",
            [
                project_threshold_config_keys,
                self.builder.column("project_id"),
            ],
            PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
        )

        project_threshold_override_config_index: SelectType = Function(
            "indexOf",
            [
                project_threshold_override_config_keys,
                (self.builder.column("project_id"), self.builder.column("transaction")),
            ],
            PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
        )

        def _project_threshold_config(alias: Optional[str] = None) -> SelectType:
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

            return Function(
                "tuple",
                [DEFAULT_PROJECT_THRESHOLD_METRIC, DEFAULT_PROJECT_THRESHOLD],
                alias,
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
                PROJECT_THRESHOLD_CONFIG_ALIAS,
            )

        return _project_threshold_config(PROJECT_THRESHOLD_CONFIG_ALIAS)

    def _resolve_team_key_transaction_alias(self, _: str) -> SelectType:
        org_id = self.builder.params.get("organization_id")
        project_ids = self.builder.params.get("project_id")
        team_ids = self.builder.params.get("team_id")

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
            [
                (self.builder.column("project_id"), self.builder.column("transaction")),
                team_key_transactions,
            ],
            TEAM_KEY_TRANSACTION_ALIAS,
        )

    def _resolve_error_unhandled_alias(self, _: str) -> SelectType:
        return Function("notHandled", [], ERROR_UNHANDLED_ALIAS)

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
                            [self.builder.resolve_field_alias("project_threshold_config"), 1],
                        ),
                        "lcp",
                    ],
                ),
                self.builder.column("measurements.lcp"),
                self.builder.column("transaction.duration"),
            ],
        )

    def _resolve_aliased_division(self, dividend: str, divisor: str, alias: str) -> SelectType:
        """Given public aliases resolve division"""
        return self.builder.resolve_division(
            self.builder.column(dividend), self.builder.column(divisor), alias
        )

    def _resolve_measurements_frames_slow_rate(self, _: str) -> SelectType:
        return self._resolve_aliased_division(
            "measurements.frames_slow", "measurements.frames_total", MEASUREMENTS_FRAMES_SLOW_RATE
        )

    def _resolve_measurements_frames_frozen_rate(self, _: str) -> SelectType:
        return self._resolve_aliased_division(
            "measurements.frames_frozen",
            "measurements.frames_total",
            MEASUREMENTS_FRAMES_FROZEN_RATE,
        )

    def _resolve_measurements_stall_percentage(self, _: str) -> SelectType:
        return self._resolve_aliased_division(
            "measurements.stall_total_time", "transaction.duration", MEASUREMENTS_STALL_PERCENTAGE
        )

    # Functions
    def _resolve_apdex_function(self, args: Mapping[str, str], alias: str) -> SelectType:
        if args["satisfaction"]:
            function_args = [self.builder.column("transaction.duration"), int(args["satisfaction"])]
        else:
            function_args = [
                self._project_threshold_multi_if_function(),
                Function(
                    "tupleElement",
                    [self.builder.resolve_field_alias("project_threshold_config"), 2],
                ),
            ]

        return Function("apdex", function_args, alias)

    def _resolve_count_miserable_function(self, args: Mapping[str, str], alias: str) -> SelectType:
        if args["satisfaction"]:
            lhs = self.builder.column("transaction.duration")
            rhs = int(args["tolerated"])
        else:
            lhs = self._project_threshold_multi_if_function()
            rhs = Function(
                "multiply",
                [
                    Function(
                        "tupleElement",
                        [self.builder.resolve_field_alias("project_threshold_config"), 2],
                    ),
                    4,
                ],
            )
        col = args["column"]

        return Function("uniqIf", [col, Function("greater", [lhs, rhs])], alias)

    def _resolve_user_misery_function(self, args: Mapping[str, str], alias: str) -> SelectType:
        if args["satisfaction"]:
            count_miserable_agg = self.builder.resolve_function(
                f"count_miserable(user,{args['satisfaction']})"
            )
        else:
            count_miserable_agg = self.builder.resolve_function("count_miserable(user)")

        return Function(
            "ifNull",
            [
                Function(
                    "divide",
                    [
                        Function(
                            "plus",
                            [
                                count_miserable_agg,
                                args["alpha"],
                            ],
                        ),
                        Function(
                            "plus",
                            [
                                Function(
                                    "nullIf", [Function("uniq", [self.builder.column("user")]), 0]
                                ),
                                args["parameter_sum"],
                            ],
                        ),
                    ],
                ),
                0,
            ],
            alias,
        )

    def _resolve_percentile(
        self,
        args: Mapping[str, Union[str, Column, SelectType, int, float]],
        alias: str,
        fixed_percentile: Optional[float] = None,
    ) -> SelectType:
        return (
            Function(
                "max",
                [args["column"]],
                alias,
            )
            if fixed_percentile == 1
            else Function(
                f'quantile({fixed_percentile if fixed_percentile is not None else args["percentile"]})',
                [args["column"]],
                alias,
            )
        )

    # Query Filters
    def _issue_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        operator = search_filter.operator
        value = to_list(search_filter.value.value)
        # `unknown` is a special value for when there is no issue associated with the event
        group_short_ids = [v for v in value if v and v != "unknown"]
        filter_values = ["" for v in value if not v or v == "unknown"]

        if group_short_ids and self.builder.params and "organization_id" in self.builder.params:
            try:
                groups = Group.objects.by_qualified_short_id_bulk(
                    self.builder.params["organization_id"],
                    group_short_ids,
                )
            except Exception:
                raise InvalidSearchQuery(f"Invalid value '{group_short_ids}' for 'issue:' filter")
            else:
                filter_values.extend(sorted(g.id for g in groups))

        return self.builder.convert_search_filter_to_condition(
            SearchFilter(
                SearchKey("issue.id"),
                operator,
                SearchValue(filter_values if search_filter.is_in_filter else filter_values[0]),
            )
        )

    def _message_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        value = search_filter.value.value
        if search_filter.value.is_wildcard():
            # XXX: We don't want the '^$' values at the beginning and end of
            # the regex since we want to find the pattern anywhere in the
            # message. Strip off here
            value = search_filter.value.value[1:-1]
            return Condition(
                Function("match", [self.builder.column("message"), f"(?i){value}"]),
                Op(search_filter.operator),
                1,
            )
        elif value == "":
            operator = Op.EQ if search_filter.operator == "=" else Op.NEQ
            return Condition(
                Function("equals", [self.builder.column("message"), value]), operator, 1
            )
        else:
            if search_filter.is_in_filter:
                return Condition(
                    self.builder.column("message"),
                    Op(search_filter.operator),
                    value,
                )

            # make message search case insensitive
            return Condition(
                Function("positionCaseInsensitive", [self.builder.column("message"), value]),
                Op.NEQ if search_filter.operator in EQUALITY_OPERATORS else Op.EQ,
                0,
            )

    def _transaction_status_filter_converter(
        self, search_filter: SearchFilter
    ) -> Optional[WhereType]:
        # Handle "has" queries
        if search_filter.value.raw_value == "":
            return Condition(
                self.builder.resolve_field(search_filter.key.name),
                Op.IS_NULL if search_filter.operator == "=" else Op.IS_NOT_NULL,
            )
        internal_value = (
            [translate_transaction_status(val) for val in search_filter.value.raw_value]
            if search_filter.is_in_filter
            else translate_transaction_status(search_filter.value.raw_value)
        )
        return Condition(
            self.builder.resolve_field(search_filter.key.name),
            Op(search_filter.operator),
            internal_value,
        )

    def _issue_id_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        name = search_filter.key.name
        value = search_filter.value.value

        lhs = self.builder.column(name)
        rhs = value

        # Handle "has" queries
        if (
            search_filter.value.raw_value == ""
            or search_filter.is_in_filter
            and [v for v in value if not v]
        ):
            if search_filter.is_in_filter:
                rhs = [v if v else 0 for v in value]
            else:
                rhs = 0

        # Skip isNull check on group_id value as we want to
        # allow snuba's prewhere optimizer to find this condition.
        return Condition(lhs, Op(search_filter.operator), rhs)

    def _error_unhandled_filter_converter(
        self,
        search_filter: SearchFilter,
    ) -> Optional[WhereType]:
        value = search_filter.value.value
        # Treat has filter as equivalent to handled
        if search_filter.value.raw_value == "":
            output = 0 if search_filter.operator == "!=" else 1
            return Condition(Function("isHandled", []), Op.EQ, output)
        if value in ("1", 1):
            return Condition(Function("notHandled", []), Op.EQ, 1)
        if value in ("0", 0):
            return Condition(Function("isHandled", []), Op.EQ, 1)
        raise InvalidSearchQuery(
            "Invalid value for error.unhandled condition. Accepted values are 1, 0"
        )

    def _error_handled_filter_converter(
        self,
        search_filter: SearchFilter,
    ) -> Optional[WhereType]:
        value = search_filter.value.value
        # Treat has filter as equivalent to handled
        if search_filter.value.raw_value == "":
            output = 1 if search_filter.operator == "!=" else 0
            return Condition(Function("isHandled", []), Op.EQ, output)
        if value in ("1", 1):
            return Condition(Function("isHandled", []), Op.EQ, 1)
        if value in ("0", 0):
            return Condition(Function("notHandled", []), Op.EQ, 1)
        raise InvalidSearchQuery(
            "Invalid value for error.handled condition. Accepted values are 1, 0"
        )

    def _key_transaction_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        value = search_filter.value.value
        key_transaction_expr = self.builder.resolve_field_alias(TEAM_KEY_TRANSACTION_ALIAS)

        if search_filter.value.raw_value == "":
            return Condition(
                key_transaction_expr, Op.NEQ if search_filter.operator == "!=" else Op.EQ, 0
            )
        if value in ("1", 1):
            return Condition(key_transaction_expr, Op.EQ, 1)
        if value in ("0", 0):
            return Condition(key_transaction_expr, Op.EQ, 0)

        raise InvalidSearchQuery(
            "Invalid value for key_transaction condition. Accepted values are 1, 0"
        )

    def _release_stage_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Parses a release stage search and returns a snuba condition to filter to the
        requested releases.
        """
        # TODO: Filter by project here as well. It's done elsewhere, but could critcally limit versions
        # for orgs with thousands of projects, each with their own releases (potentailly drowning out ones we care about)

        if "organization_id" not in self.builder.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.builder.params["organization_id"]
        project_ids: Optional[List[int]] = self.builder.params.get("project_id")
        environments: Optional[List[Environment]] = self.builder.params.get(
            "environment_objects", []
        )
        qs = (
            Release.objects.filter_by_stage(
                organization_id,
                search_filter.operator,
                search_filter.value.value,
                project_ids=project_ids,
                environments=environments,
            )
            .values_list("version", flat=True)
            .order_by("date_added")[:MAX_SEARCH_RELEASES]
        )
        versions = list(qs)

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.builder.column("release"), Op.IN, versions)

    def _semver_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Parses a semver query search and returns a snuba condition to filter to the
        requested releases.

        Since we only have semver information available in Postgres currently, we query
        Postgres and return a list of versions to include/exclude. For most customers this
        will work well, however some have extremely large numbers of releases, and we can't
        pass them all to Snuba. To try and serve reasonable results, we:
         - Attempt to query based on the initial semver query. If this returns
           MAX_SEMVER_SEARCH_RELEASES results, we invert the query and see if it returns
           fewer results. If so, we use a `NOT IN` snuba condition instead of an `IN`.
         - Order the results such that the versions we return are semantically closest to
           the passed filter. This means that when searching for `>= 1.0.0`, we'll return
           version 1.0.0, 1.0.1, 1.1.0 before 9.x.x.
        """
        if "organization_id" not in self.builder.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.builder.params["organization_id"]
        project_ids: Optional[List[int]] = self.builder.params.get("project_id")
        # We explicitly use `raw_value` here to avoid converting wildcards to shell values
        version: str = search_filter.value.raw_value
        operator: str = search_filter.operator

        # Note that we sort this such that if we end up fetching more than
        # MAX_SEMVER_SEARCH_RELEASES, we will return the releases that are closest to
        # the passed filter.
        order_by = Release.SEMVER_COLS
        if operator.startswith("<"):
            order_by = list(map(_flip_field_sort, order_by))
        qs = (
            Release.objects.filter_by_semver(
                organization_id,
                parse_semver(version, operator),
                project_ids=project_ids,
            )
            .values_list("version", flat=True)
            .order_by(*order_by)[:MAX_SEARCH_RELEASES]
        )
        versions = list(qs)
        final_operator = Op.IN
        if len(versions) == MAX_SEARCH_RELEASES:
            # We want to limit how many versions we pass through to Snuba. If we've hit
            # the limit, make an extra query and see whether the inverse has fewer ids.
            # If so, we can do a NOT IN query with these ids instead. Otherwise, we just
            # do our best.
            operator = OPERATOR_NEGATION_MAP[operator]
            # Note that the `order_by` here is important for index usage. Postgres seems
            # to seq scan with this query if the `order_by` isn't included, so we
            # include it even though we don't really care about order for this query
            qs_flipped = (
                Release.objects.filter_by_semver(organization_id, parse_semver(version, operator))
                .order_by(*map(_flip_field_sort, order_by))
                .values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
            )

            exclude_versions = list(qs_flipped)
            if exclude_versions and len(exclude_versions) < len(versions):
                # Do a negative search instead
                final_operator = Op.NOT_IN
                versions = exclude_versions

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.builder.column("release"), final_operator, versions)

    def _semver_package_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Applies a semver package filter to the search. Note that if the query returns more than
        `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
        """
        if "organization_id" not in self.builder.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.builder.params["organization_id"]
        project_ids: Optional[List[int]] = self.builder.params.get("project_id")
        package: str = search_filter.value.raw_value

        versions = list(
            Release.objects.filter_by_semver(
                organization_id,
                SemverFilter("exact", [], package),
                project_ids=project_ids,
            ).values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
        )

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.builder.column("release"), Op.IN, versions)

    def _semver_build_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Applies a semver build filter to the search. Note that if the query returns more than
        `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
        """
        if "organization_id" not in self.builder.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.builder.params["organization_id"]
        project_ids: Optional[List[int]] = self.builder.params.get("project_id")
        build: str = search_filter.value.raw_value

        operator, negated = handle_operator_negation(search_filter.operator)
        versions = list(
            Release.objects.filter_by_semver_build(
                organization_id,
                OPERATOR_TO_DJANGO[operator],
                build,
                project_ids=project_ids,
                negated=negated,
            ).values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
        )

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.builder.column("release"), Op.IN, versions)
