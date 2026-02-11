from __future__ import annotations

from collections.abc import Callable, Mapping

import sentry_sdk
from django.utils.functional import cached_property
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from snuba_sdk import (
    Column,
    Condition,
    CurriedFunction,
    Direction,
    Entity,
    Function,
    Identifier,
    Lambda,
    Op,
    OrderBy,
)

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
)
from sentry.search.events.builder import discover
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.constants import (
    ARRAY_FIELDS,
    DEFAULT_PROJECT_THRESHOLD,
    DEFAULT_PROJECT_THRESHOLD_METRIC,
    DEVICE_CLASS_ALIAS,
    ERROR_HANDLED_ALIAS,
    ERROR_UNHANDLED_ALIAS,
    EVENT_TYPE_ALIAS,
    FUNCTION_ALIASES,
    HTTP_STATUS_CODE_ALIAS,
    ISSUE_ALIAS,
    ISSUE_ID_ALIAS,
    MAX_QUERYABLE_TRANSACTION_THRESHOLDS,
    MEASUREMENTS_FRAMES_FROZEN_RATE,
    MEASUREMENTS_FRAMES_SLOW_RATE,
    MEASUREMENTS_STALL_PERCENTAGE,
    MISERY_ALPHA,
    MISERY_BETA,
    NON_FAILURE_STATUS,
    PRECISE_FINISH_TS,
    PRECISE_START_TS,
    PROJECT_ALIAS,
    PROJECT_NAME_ALIAS,
    PROJECT_THRESHOLD_CONFIG_ALIAS,
    PROJECT_THRESHOLD_CONFIG_INDEX_ALIAS,
    PROJECT_THRESHOLD_OVERRIDE_CONFIG_INDEX_ALIAS,
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
    TEAM_KEY_TRANSACTION_ALIAS,
    TIMESTAMP_TO_DAY_ALIAS,
    TIMESTAMP_TO_HOUR_ALIAS,
    TOTAL_COUNT_ALIAS,
    TOTAL_TRANSACTION_DURATION_ALIAS,
    TRACE_PARENT_SPAN_ALIAS,
    TRACE_PARENT_SPAN_CONTEXT,
    TRANSACTION_STATUS_ALIAS,
    USER_DISPLAY_ALIAS,
    VITAL_THRESHOLDS,
)
from sentry.search.events.datasets import field_aliases, filter_aliases, function_aliases
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
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
    normalize_count_if_condition,
    normalize_count_if_value,
    normalize_percentile_alias,
    with_default,
)
from sentry.search.events.filter import to_list
from sentry.search.events.types import SelectType, WhereType
from sentry.search.utils import DEVICE_CLASS
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.numbers import format_grouped_length


class InvalidIssueSearchQuery(InvalidSearchQuery):
    """Raised when an issue filter references non-existent issue IDs."""

    def __init__(self, invalid_ids: list[str]):
        self.invalid_ids = invalid_ids
        super().__init__(f"Issue IDs do not exist: {invalid_ids}")

    def __str__(self) -> str:
        return f"Issue IDs do not exist: {self.invalid_ids}"


class DiscoverDatasetConfig(DatasetConfig):
    custom_threshold_columns = {
        "apdex()",
        "count_miserable(user)",
        "user_misery()",
    }
    non_nullable_keys = {"event.type"}
    nullable_context_keys = {"thread.id"}
    use_entity_prefix_for_fields: bool = False

    def __init__(self, builder: BaseQueryBuilder):
        self.builder = builder
        self.total_count: int | None = None
        self.total_sum_transaction_duration: float | None = None

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], WhereType | None]]:
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
            TRACE_PARENT_SPAN_ALIAS: self._trace_parent_span_converter,
            "performance.issue_ids": self._performance_issue_ids_filter_converter,
            EVENT_TYPE_ALIAS: self._event_type_filter_converter,
            "transaction": self._transaction_filter_converter,
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
            ERROR_HANDLED_ALIAS: self._resolve_error_handled_alias,
            ERROR_UNHANDLED_ALIAS: self._resolve_error_unhandled_alias,
            TEAM_KEY_TRANSACTION_ALIAS: self._resolve_team_key_transaction_alias,
            MEASUREMENTS_FRAMES_SLOW_RATE: self._resolve_measurements_frames_slow_rate,
            MEASUREMENTS_FRAMES_FROZEN_RATE: self._resolve_measurements_frames_frozen_rate,
            MEASUREMENTS_STALL_PERCENTAGE: self._resolve_measurements_stall_percentage,
            HTTP_STATUS_CODE_ALIAS: self._resolve_http_status_code,
            TOTAL_COUNT_ALIAS: self._resolve_total_count,
            TOTAL_TRANSACTION_DURATION_ALIAS: self._resolve_total_sum_transaction_duration,
            DEVICE_CLASS_ALIAS: self._resolve_device_class,
            PRECISE_FINISH_TS: lambda alias: field_aliases.resolve_precise_timestamp(
                Column("finish_ts"), Column("finish_ms"), alias
            ),
            PRECISE_START_TS: lambda alias: field_aliases.resolve_precise_timestamp(
                Column("start_ts"), Column("start_ms"), alias
            ),
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
                                    [
                                        SPAN_STATUS_NAME_TO_CODE[status]
                                        for status in NON_FAILURE_STATUS
                                    ],
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
                            "fn": lambda args: (
                                args["satisfaction"] * 4.0
                                if args["satisfaction"] is not None
                                else None
                            ),
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
                        with_default(MISERY_ALPHA, NumberRange("alpha", 0, None)),
                        with_default(MISERY_BETA, NumberRange("beta", 0, None)),
                    ],
                    calculated_args=[
                        {
                            "name": "tolerated",
                            "fn": lambda args: (
                                args["satisfaction"] * 4.0
                                if args["satisfaction"] is not None
                                else None
                            ),
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
                    "count_web_vitals",
                    required_args=[
                        NumericColumn("column"),
                        SnQLStringArg("quality", allowed_strings=["good", "meh", "poor", "any"]),
                    ],
                    snql_aggregate=self._resolve_web_vital_function,
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
                    "group_uniq_array",
                    required_args=[NumberRange("max_size", 0, 101), ColumnTagArg("column")],
                    snql_aggregate=lambda args, alias: CurriedFunction(
                        "groupUniqArray",
                        [int(args["max_size"])],
                        [args["column"]],
                        alias,
                    ),
                    default_result_type="string",  # TODO: support array type
                    private=True,
                ),
                SnQLFunction(
                    "percentile",
                    required_args=[
                        NumericColumn("column"),
                        NumberRange("percentile", 0, 1),
                    ],
                    snql_aggregate=self._resolve_percentile,
                    result_type_fn=self.reflective_result_type(),
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
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p75",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.75),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p90",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.90),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p95",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.95),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p99",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 0.99),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "p100",
                    optional_args=[
                        with_default("transaction.duration", NumericColumn("column")),
                    ],
                    snql_aggregate=lambda args, alias: self._resolve_percentile(args, alias, 1),
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "to_other",
                    required_args=[
                        ColumnArg(
                            "column",
                            allowed_columns=["release", "trace.parent_span", "id", "trace.span"],
                        ),
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
                    "random_number",
                    snql_aggregate=lambda args, alias: Function(
                        "rand",
                        [],
                        alias,
                    ),
                    default_result_type="integer",
                    private=True,
                ),
                SnQLFunction(
                    "modulo",
                    required_args=[SnQLStringArg("column"), NumberRange("factor", None, None)],
                    snql_aggregate=lambda args, alias: Function(
                        "modulo",
                        [Column(args["column"]), args["factor"]],
                        alias,
                    ),
                    default_result_type="integer",
                    private=True,
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
                        },
                        {
                            "name": "normalized_condition",
                            "fn": normalize_count_if_condition,
                        },
                        {
                            "name": "is_array_field",
                            "fn": lambda args: args["column"] in ARRAY_FIELDS,
                        },
                    ],
                    snql_aggregate=self._resolve_count_if,
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
                    result_type_fn=self.reflective_result_type(),
                    default_result_type="duration",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "max",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("max", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
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
                    result_type_fn=self.reflective_result_type(),
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
                    "linear_regression",
                    required_args=[NumericColumn("column1"), NumericColumn("column2")],
                    snql_aggregate=lambda args, alias: Function(
                        "simpleLinearRegression", [args["column1"], args["column2"]], alias
                    ),
                    default_result_type="number",
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "sum",
                    required_args=[NumericColumn("column")],
                    snql_aggregate=lambda args, alias: Function("sum", [args["column"]], alias),
                    result_type_fn=self.reflective_result_type(),
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
                    result_type_fn=self.reflective_result_type(),
                    redundant_grouping=True,
                ),
                SnQLFunction(
                    "eps",
                    snql_aggregate=lambda args, alias: function_aliases.resolve_eps(
                        args, alias, self.builder
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                SnQLFunction(
                    "epm",
                    snql_aggregate=lambda args, alias: function_aliases.resolve_epm(
                        args, alias, self.builder
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
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
                    required_args=[ColumnArg("column")],
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
                SnQLFunction(
                    "spans_histogram",
                    required_args=[
                        SnQLStringArg("spans_op", True, True),
                        SnQLStringArg("spans_group"),
                        # the bucket_size and start_offset should already be adjusted
                        # using the multiplier before it is passed here
                        NumberRange("bucket_size", 0, None),
                        NumberRange("start_offset", 0, None),
                        NumberRange("multiplier", 1, None),
                    ],
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
                                                                    Function(
                                                                        "arrayJoin",
                                                                        [
                                                                            Function(
                                                                                "arrayFilter",
                                                                                [
                                                                                    Lambda(
                                                                                        [
                                                                                            "x",
                                                                                            "y",
                                                                                            "z",
                                                                                        ],
                                                                                        Function(
                                                                                            "and",
                                                                                            [
                                                                                                Function(
                                                                                                    "equals",
                                                                                                    [
                                                                                                        Identifier(
                                                                                                            "y"
                                                                                                        ),
                                                                                                        args[
                                                                                                            "spans_op"
                                                                                                        ],
                                                                                                    ],
                                                                                                ),
                                                                                                Function(
                                                                                                    "equals",
                                                                                                    [
                                                                                                        Identifier(
                                                                                                            "z",
                                                                                                        ),
                                                                                                        args[
                                                                                                            "spans_group"
                                                                                                        ],
                                                                                                    ],
                                                                                                ),
                                                                                            ],
                                                                                        ),
                                                                                    ),
                                                                                    Column(
                                                                                        "spans.exclusive_time"
                                                                                    ),
                                                                                    Column(
                                                                                        "spans.op"
                                                                                    ),
                                                                                    Column(
                                                                                        "spans.group"
                                                                                    ),
                                                                                ],
                                                                            )
                                                                        ],
                                                                    ),
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
                SnQLFunction(
                    "fn_span_count",
                    required_args=[
                        SnQLStringArg("spans_op", True, True),
                        SnQLStringArg("fn"),
                    ],
                    snql_column=lambda args, alias: Function(
                        args["fn"],
                        [
                            Function(
                                "length",
                                [
                                    Function(
                                        "arrayFilter",
                                        [
                                            Lambda(
                                                [
                                                    "x",
                                                ],
                                                Function(
                                                    "equals",
                                                    [
                                                        Identifier("x"),
                                                        args["spans_op"],
                                                    ],
                                                ),
                                            ),
                                            Column("spans.op"),
                                        ],
                                    )
                                ],
                                "span_count",
                            )
                        ],
                        alias,
                    ),
                ),
                SnQLFunction(
                    "floored_epm",
                    snql_aggregate=lambda args, alias: Function(
                        "pow",
                        [
                            10,
                            Function(
                                "floor",
                                [
                                    Function(
                                        "log10",
                                        [
                                            Function(
                                                "divide",
                                                [
                                                    Function("count", []),
                                                    Function("divide", [args["interval"], 60]),
                                                ],
                                            )
                                        ],
                                    )
                                ],
                            ),
                        ],
                        alias,
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="number",
                ),
                SnQLFunction(
                    "fn_span_exclusive_time",
                    required_args=[
                        SnQLStringArg("spans_op", True, True),
                        SnQLStringArg("spans_group"),
                        SnQLStringArg("fn"),
                    ],
                    snql_column=lambda args, alias: Function(
                        args["fn"],
                        [
                            Function(
                                "arrayJoin",
                                [
                                    Function(
                                        "arrayFilter",
                                        [
                                            Lambda(
                                                [
                                                    "x",
                                                    "y",
                                                    "z",
                                                ],
                                                Function(
                                                    "and",
                                                    [
                                                        Function(
                                                            "equals",
                                                            [
                                                                Identifier("y"),
                                                                args["spans_op"],
                                                            ],
                                                        ),
                                                        Function(
                                                            "equals",
                                                            [
                                                                Identifier(
                                                                    "z",
                                                                ),
                                                                args["spans_group"],
                                                            ],
                                                        ),
                                                    ],
                                                ),
                                            ),
                                            Column("spans.exclusive_time"),
                                            Column("spans.op"),
                                            Column("spans.group"),
                                        ],
                                    )
                                ],
                                "exclusive_time",
                            )
                        ],
                        alias,
                    ),
                    default_result_type="number",
                    private=True,
                ),
                SnQLFunction(
                    "performance_score",
                    required_args=[
                        NumericColumn("column"),
                    ],
                    snql_aggregate=self._resolve_web_vital_score_function,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "opportunity_score",
                    required_args=[
                        NumericColumn("column"),
                    ],
                    snql_aggregate=self._resolve_web_vital_opportunity_score_function,
                    default_result_type="number",
                ),
                SnQLFunction(
                    "count_scores",
                    required_args=[
                        NumericColumn("column"),
                    ],
                    snql_aggregate=self._resolve_count_scores_function,
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "examples",
                    required_args=[NumericColumn("column")],
                    optional_args=[with_default(1, NumberRange("count", 1, None))],
                    snql_aggregate=self._resolve_random_samples,
                    private=True,
                ),
                SnQLFunction(
                    "rounded_timestamp",
                    required_args=[IntervalDefault("interval", 1, None)],
                    snql_column=lambda args, alias: function_aliases.resolve_rounded_timestamp(
                        args["interval"], alias
                    ),
                    private=True,
                ),
                SnQLFunction(
                    "column_hash",
                    # TODO: this supports only one column, but hash functions can support arbitrary parameters
                    required_args=[ColumnArg("column")],
                    snql_aggregate=lambda args, alias: Function(
                        "farmFingerprint64",  # farmFingerprint64 aka farmHash64 is a newer, faster replacement for cityHash64
                        [args["column"]],
                        alias,
                    ),
                    default_result_type="integer",
                    private=True,
                ),
                SnQLFunction(
                    "upsampled_count",
                    required_args=[],
                    snql_aggregate=lambda args, alias: Function(
                        "toInt64",
                        [
                            Function(
                                "sum",
                                [
                                    Function(
                                        "ifNull",
                                        [
                                            Column(
                                                "sample_weight",
                                                entity=Entity("events", alias="events"),
                                            ),
                                            1,
                                        ],
                                    )
                                ],
                            )
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
                SnQLFunction(
                    "upsampled_eps",
                    snql_aggregate=lambda args, alias: function_aliases.resolve_upsampled_eps(
                        args, alias, self.builder
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
                SnQLFunction(
                    "upsampled_epm",
                    snql_aggregate=lambda args, alias: function_aliases.resolve_upsampled_epm(
                        args, alias, self.builder
                    ),
                    optional_args=[IntervalDefault("interval", 1, None)],
                    default_result_type="rate",
                ),
            ]
        }

        for alias, name in FUNCTION_ALIASES.items():
            function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    @property
    def orderby_converter(self) -> Mapping[str, Callable[[Direction], OrderBy]]:
        return {
            PROJECT_ALIAS: self._project_slug_orderby_converter,
            PROJECT_NAME_ALIAS: self._project_slug_orderby_converter,
        }

    def _project_slug_orderby_converter(self, direction: Direction) -> OrderBy:
        project_ids = {project_id for project_id in self.builder.params.project_ids}

        # Try to reduce the size of the transform by using any existing conditions on projects
        # Do not optimize projects list if conditions contain OR operator
        if not self.builder.has_or_condition and len(self.builder.projects_to_filter) > 0:
            project_ids &= self.builder.projects_to_filter

        # Order by id so queries are consistent
        projects = Project.objects.filter(id__in=project_ids).values("slug", "id").order_by("id")

        return OrderBy(
            Function(
                "transform",
                [
                    self.builder.column("project.id"),
                    [project["id"] for project in projects],
                    [project["slug"] for project in projects],
                    "",
                ],
            ),
            direction,
        )

    # Field Aliases
    def _resolve_project_slug_alias(self, alias: str) -> SelectType:
        return field_aliases.resolve_project_slug_alias(self.builder, alias)

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

    def _resolve_http_status_code(self, _: str) -> SelectType:
        return Function(
            "coalesce",
            [
                Function("nullif", [self.builder.column("http.status_code"), ""]),
                self.builder.column("tags[http.status_code]"),
            ],
            HTTP_STATUS_CODE_ALIAS,
        )

    @cached_property
    def _resolve_project_threshold_config(self) -> SelectType:
        project_thresholds = {}
        project_threshold_config_keys = []
        project_threshold_config_values = []

        project_threshold_override_config_keys = []
        project_threshold_override_config_values = []

        org_id = self.builder.params.organization_id
        project_ids = self.builder.params.project_ids

        if org_id is not None:
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
            for project_id, threshold, metric in project_threshold_configs:
                metric_name = TRANSACTION_METRICS[metric]
                if (
                    threshold == DEFAULT_PROJECT_THRESHOLD
                    and metric_name == DEFAULT_PROJECT_THRESHOLD_METRIC
                ):
                    # small optimization, if the configuration is equal to the default,
                    # we can skip it in the final query
                    continue

                project_thresholds[project_id] = (metric_name, threshold)
                project_threshold_config_keys.append(Function("toUInt64", [project_id]))
                project_threshold_config_values.append((metric_name, threshold))

            for transaction, project_id, threshold, metric in transaction_threshold_configs:
                metric_name = TRANSACTION_METRICS[metric]
                if (
                    project_id in project_thresholds
                    and threshold == project_thresholds[project_id][1]
                    and metric_name == project_thresholds[project_id][0]
                ):
                    # small optimization, if the configuration is equal to the project
                    # configs, we can skip it in the final query
                    continue

                elif (
                    project_id not in project_thresholds
                    and threshold == DEFAULT_PROJECT_THRESHOLD
                    and metric_name == DEFAULT_PROJECT_THRESHOLD_METRIC
                ):
                    # small optimization, if the configuration is equal to the default
                    # and no project configs were set, we can skip it in the final query
                    continue

                project_threshold_override_config_keys.append(
                    (Function("toUInt64", [project_id]), transaction)
                )
                project_threshold_override_config_values.append((metric_name, threshold))

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
        return field_aliases.resolve_team_key_transaction_alias(self.builder)

    def _resolve_error_handled_alias(self, _: str) -> SelectType:
        return Function("isHandled", [], ERROR_HANDLED_ALIAS)

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
        return function_aliases.resolve_division(
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

    def _resolve_total_count(self, alias: str) -> SelectType:
        """This must be cached since it runs another query"""
        self.builder.requires_other_aggregates = True
        if self.total_count is not None:
            return Function("toUInt64", [self.total_count], alias)
        total_query = discover.DiscoverQueryBuilder(
            dataset=self.builder.dataset,
            params={},
            snuba_params=self.builder.params,
            selected_columns=["count()"],
        )
        total_query.columns += self.builder.resolve_groupby()
        total_query.where = self.builder.where
        total_results = total_query.run_query(Referrer.API_DISCOVER_TOTAL_COUNT_FIELD.value)
        results = total_query.process_results(total_results)
        if len(results["data"]) != 1:
            self.total_count = 0
            return Function("toUInt64", [0], alias)
        self.total_count = results["data"][0]["count"]
        return Function("toUInt64", [self.total_count], alias)

    def _resolve_total_sum_transaction_duration(self, alias: str) -> SelectType:
        """This must be cached since it runs another query"""
        self.builder.requires_other_aggregates = True
        if self.total_sum_transaction_duration is not None:
            return Function("toFloat64", [self.total_sum_transaction_duration], alias)
        # TODO[Shruthi]: Figure out parametrization of the args to sum()
        total_query = discover.DiscoverQueryBuilder(
            dataset=self.builder.dataset,
            params={},
            snuba_params=self.builder.params,
            selected_columns=["sum(transaction.duration)"],
        )
        total_query.columns += self.builder.resolve_groupby()
        total_query.where = self.builder.where
        total_results = total_query.run_query(
            Referrer.API_DISCOVER_TOTAL_SUM_TRANSACTION_DURATION_FIELD.value
        )
        results = total_query.process_results(total_results)
        if len(results["data"]) != 1:
            self.total_sum_transaction_duration = 0
            return Function("toFloat64", [0], alias)
        self.total_sum_transaction_duration = results["data"][0]["sum_transaction_duration"]
        return Function("toFloat64", [self.total_sum_transaction_duration], alias)

    def _resolve_device_class(self, _: str) -> SelectType:
        return Function(
            "multiIf",
            [
                Function(
                    "in", [self.builder.column("tags[device.class]"), list(DEVICE_CLASS["low"])]
                ),
                "low",
                Function(
                    "in",
                    [
                        self.builder.column("tags[device.class]"),
                        list(DEVICE_CLASS["medium"]),
                    ],
                ),
                "medium",
                Function(
                    "in",
                    [
                        self.builder.column("tags[device.class]"),
                        list(DEVICE_CLASS["high"]),
                    ],
                ),
                "high",
                None,
            ],
            DEVICE_CLASS_ALIAS,
        )

    # Functions
    def _resolve_apdex_function(self, args: Mapping[str, str], alias: str) -> SelectType:
        if args["satisfaction"]:
            column = self.builder.column("transaction.duration")
            satisfaction = int(args["satisfaction"])
        else:
            column = self._project_threshold_multi_if_function()
            satisfaction = Function(
                "tupleElement",
                [self.builder.resolve_field_alias("project_threshold_config"), 2],
            )
        count_satisfaction = Function(  # countIf(column<satisfaction)
            "countIf", [Function("lessOrEquals", [column, satisfaction])]
        )
        count_tolerable = Function(  # countIf(satisfaction<column<=satisfacitonx4)
            "countIf",
            [
                Function(
                    "and",
                    [
                        Function("greater", [column, satisfaction]),
                        Function("lessOrEquals", [column, Function("multiply", [satisfaction, 4])]),
                    ],
                )
            ],
        )
        count_tolerable_div_2 = Function("divide", [count_tolerable, 2])
        count_total = Function(  # Only count if the column exists (doing >=0 covers that)
            "countIf", [Function("greaterOrEquals", [column, 0])]
        )

        return function_aliases.resolve_division(  # (satisfied + tolerable/2)/(total)
            Function(
                "plus",
                [
                    count_satisfaction,
                    count_tolerable_div_2,
                ],
            ),
            count_total,
            alias,
            # TODO(zerofill): This behaviour is incorrect if we remove zerofilling
            # But need to do something reasonable here since we'll get a null row otherwise
            fallback=0,
        )

    def _resolve_web_vital_function(
        self, args: Mapping[str, str | Column], alias: str
    ) -> SelectType:
        column = args["column"]
        quality = args["quality"].lower()

        assert isinstance(column, Column), "first arg to count_web_vitals must be a column"
        if column.subscriptable != "measurements":
            raise InvalidSearchQuery("count_web_vitals only supports measurements")
        elif column.key not in VITAL_THRESHOLDS:
            raise InvalidSearchQuery(f"count_web_vitals doesn't support {column.key}")

        if quality == "good":
            return Function(
                "countIf",
                [Function("less", [column, VITAL_THRESHOLDS[column.key]["meh"]])],
                alias,
            )
        elif quality == "meh":
            return Function(
                "countIf",
                [
                    Function(
                        "and",
                        [
                            Function(
                                "greaterOrEquals", [column, VITAL_THRESHOLDS[column.key]["meh"]]
                            ),
                            Function("less", [column, VITAL_THRESHOLDS[column.key]["poor"]]),
                        ],
                    )
                ],
                alias,
            )
        elif quality == "poor":
            return Function(
                "countIf",
                [
                    Function(
                        "greaterOrEquals",
                        [
                            column,
                            VITAL_THRESHOLDS[column.key]["poor"],
                        ],
                    )
                ],
                alias,
            )
        elif quality == "any":
            return Function(
                "countIf",
                [
                    Function(
                        "greaterOrEquals",
                        [
                            column,
                            0,
                        ],
                    )
                ],
                alias,
            )
        return None

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
        if satisfaction := args["satisfaction"]:
            column = self.builder.column("transaction.duration")
            count_miserable_agg = self.builder.resolve_function(
                f"count_miserable(user,{satisfaction})"
            )
        else:
            column = self._project_threshold_multi_if_function()
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
                                    "nullIf",
                                    [
                                        Function(  # Only count if the column exists (doing >=0 covers that)
                                            "uniqIf",
                                            [
                                                self.builder.column("user"),
                                                Function("greater", [column, 0]),
                                            ],
                                        ),
                                        0,
                                    ],
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

    def _resolve_count_if(self, args: Mapping[str, str], alias: str) -> SelectType:
        condition = args["normalized_condition"]
        is_array_field = args["is_array_field"]

        if is_array_field:
            array_condition = Function(
                "has",
                [
                    args["column"],
                    args["typed_value"],
                ],
            )

            if condition == "notEquals":
                return Function(
                    "countIf",
                    [
                        Function(
                            "equals",
                            [
                                array_condition,
                                0,
                            ],
                        ),
                    ],
                    alias,
                )

            return Function(
                "countIf",
                [array_condition],
                alias,
            )

        return Function(
            "countIf",
            [
                Function(
                    condition,
                    [
                        args["column"],
                        args["typed_value"],
                    ],
                )
            ],
            alias,
        )

    def _resolve_percentile(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str,
        fixed_percentile: float | None = None,
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

    def _resolve_web_vital_score_function(
        self,
        args: Mapping[str, Column],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        if column.key not in [
            "score.lcp",
            "score.fcp",
            "score.fid",
            "score.cls",
            "score.ttfb",
        ]:
            raise InvalidSearchQuery(
                "performance_score only supports performance score measurements"
            )
        weight_column = self.builder.column(
            "measurements." + column.key.replace("score", "score.weight")
        )
        return Function(
            "greatest",
            [
                Function(
                    "least",
                    [
                        Function(
                            "divide",
                            [
                                Function(
                                    "sum",
                                    [column],
                                ),
                                Function(
                                    "sum",
                                    [weight_column],
                                ),
                            ],
                        ),
                        1.0,
                    ],
                ),
                0.0,
            ],
            alias,
        )

    def _resolve_web_vital_opportunity_score_function(
        self,
        args: Mapping[str, Column],
        alias: str,
    ) -> SelectType:
        column = args["column"]
        if column.key not in [
            "score.lcp",
            "score.fcp",
            "score.fid",
            "score.cls",
            "score.ttfb",
            "score.total",
        ]:
            raise InvalidSearchQuery(
                "opportunity_score only supports performance score measurements"
            )

        weight_column = (
            1
            if column.key == "score.total"
            else self.builder.column("measurements." + column.key.replace("score", "score.weight"))
        )
        return Function(
            "sum",
            [Function("minus", [weight_column, Function("least", [1, column])])],
            alias,
        )

    def _resolve_count_scores_function(self, args: Mapping[str, Column], alias: str) -> SelectType:
        column = args["column"]

        if column.key not in [
            "score.total",
            "score.lcp",
            "score.fcp",
            "score.fid",
            "score.cls",
            "score.ttfb",
        ]:
            raise InvalidSearchQuery("count_scores only supports performance score measurements")

        return Function(
            "countIf",
            [
                Function(
                    "isNotNull",
                    [
                        column,
                    ],
                )
            ],
            alias,
        )

    def _resolve_random_samples(
        self,
        args: Mapping[str, str | Column | SelectType | int | float],
        alias: str,
    ) -> SelectType:
        offset = 0 if self.builder.offset is None else self.builder.offset.offset
        limit = 0 if self.builder.limit is None else self.builder.limit.limit
        return function_aliases.resolve_random_samples(
            [
                # DO NOT change the order of these columns as it
                # changes the order of the tuple in the response
                # which WILL cause errors where it assumes this
                # order
                self.builder.resolve_column("timestamp"),
                self.builder.resolve_column("span_id"),
                args["column"],
            ],
            alias,
            offset,
            limit,
            size=int(args["count"]),
        )

    # Query Filters
    def _project_slug_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.project_slug_converter(self.builder, search_filter)

    def _release_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.release_filter_converter(self.builder, search_filter)

    def _release_stage_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.release_stage_filter_converter(self.builder, search_filter)

    def _semver_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.semver_filter_converter(self.builder, search_filter)

    def _semver_package_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.semver_package_filter_converter(self.builder, search_filter)

    def _semver_build_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.semver_build_filter_converter(self.builder, search_filter)

    def _issue_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        if self.builder.builder_config.skip_field_validation_for_entity_subscription_deletion:
            return None

        operator = search_filter.operator
        value = to_list(search_filter.value.value)
        # `unknown` is a special value for when there is no issue associated with the event
        group_short_ids = [v for v in value if v and v != "unknown"]
        general_group_filter_values = [0 for v in value if not v or v == "unknown"]

        if group_short_ids and self.builder.params.organization is not None:
            try:
                groups = Group.objects.by_qualified_short_id_bulk(
                    self.builder.params.organization.id,
                    group_short_ids,
                )
            except Group.DoesNotExist:
                raise InvalidIssueSearchQuery(group_short_ids)
            except Exception:
                raise InvalidSearchQuery(f"Invalid value '{group_short_ids}' for 'issue:' filter")
            else:
                general_group_filter_values.extend(sorted([group.id for group in groups]))

        if general_group_filter_values:
            return self.builder.convert_search_filter_to_condition(
                SearchFilter(
                    SearchKey("issue.id"),
                    operator,
                    SearchValue(
                        general_group_filter_values
                        if search_filter.is_in_filter
                        else general_group_filter_values[0]
                    ),
                )
            )

        return None

    def _message_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.message_filter_converter(self.builder, search_filter)

    def _trace_parent_span_converter(self, search_filter: SearchFilter) -> WhereType | None:
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            return Condition(
                Function("has", [Column("contexts.key"), TRACE_PARENT_SPAN_CONTEXT]),
                Op.EQ if search_filter.operator == "!=" else Op.NEQ,
                1,
            )
        else:
            return self.builder.default_filter_converter(search_filter)

    def _transaction_status_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.span_status_filter_converter(self.builder, search_filter)

    def _performance_issue_ids_filter_converter(
        self, search_filter: SearchFilter
    ) -> WhereType | None:
        name = search_filter.key.name
        operator = search_filter.operator
        value = to_list(search_filter.value.value)
        value_list_as_ints = []

        lhs = self.builder.column(name)

        for v in value:
            if isinstance(v, str) and v.isdigit():
                value_list_as_ints.append(int(v))
            elif isinstance(v, int):
                value_list_as_ints.append(v)
            elif isinstance(v, str) and not v:
                value_list_as_ints.append(0)
            else:
                raise InvalidSearchQuery("performance.issue_ids should be a number")

        if search_filter.is_in_filter:
            return Condition(
                Function("hasAny", [lhs, value_list_as_ints]),
                Op.EQ if operator == "IN" else Op.NEQ,
                1,
            )
        elif search_filter.value.raw_value == "":
            return Condition(
                Function("notEmpty", [lhs]),
                Op.EQ if operator == "!=" else Op.NEQ,
                1,
            )
        else:
            return Condition(
                Function("has", [lhs, value_list_as_ints[0]]),
                Op(search_filter.operator),
                1,
            )

    def _issue_id_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
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
    ) -> WhereType | None:
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
    ) -> WhereType | None:
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

    def _key_transaction_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        return filter_aliases.team_key_transaction_filter(self.builder, search_filter)

    def _event_type_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        if self.builder.dataset == Dataset.Transactions:
            if search_filter.operator in ["=", "IN"] and search_filter.value.value in [
                "transaction",
                ["transaction"],
            ]:
                return None

        return self.builder.default_filter_converter(search_filter)

    def _transaction_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        if self.builder.dataset == Dataset.Transactions:
            operator = search_filter.operator
            value = search_filter.value.value

            if operator in ("=", "!=") and value == "":
                # !has:transaction
                if operator == "=":
                    raise InvalidSearchQuery(
                        "All events have a transaction so this query wouldn't return anything"
                    )
                else:
                    # All events have a "transaction" since we map null -> unparam so no need to filter
                    return None

        return self.builder.default_filter_converter(search_filter)
