from __future__ import annotations

from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, Field, root_validator, validator

from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidgetDisplayTypes,
    DashboardWidgetTypes,
    get_max_widget_limit,
)

GRID_WIDTH = 6

DISPLAY_TYPE_BLOCKLIST: set[str] = {
    "details",
    "server_tree",
    "rage_and_dead_clicks",
    "wheel",
    "agents_traces_table",
}

# Most of these are deprecated, not selectable in the UI, or don't make sense for generated dashboards.
WIDGET_TYPE_BLOCKLIST: set[str] = {
    "discover",
    "metrics",
    "transaction-like",
    "preprod-app-size",
}

_ALLOWED_DISPLAY_TYPES = tuple(
    t for t in DashboardWidgetDisplayTypes.TYPE_NAMES if t not in DISPLAY_TYPE_BLOCKLIST
)
_ALLOWED_WIDGET_TYPES = tuple(
    t for t in DashboardWidgetTypes.TYPE_NAMES if t not in WIDGET_TYPE_BLOCKLIST
)

DisplayType: TypeAlias = Literal[tuple(_ALLOWED_DISPLAY_TYPES)]  # type: ignore[valid-type]
WidgetType: TypeAlias = Literal[tuple(_ALLOWED_WIDGET_TYPES)]  # type: ignore[valid-type]

Intervals = Literal["5m", "15m", "30m", "1h", "4h", "12h", "24h"]

# Blocklist for frequently hallucinated functions or functions we want to avoid using
FUNCTION_BLOCKLIST: set[str] = {"spm", "apdex", "http_error_count", "http_error_count_percent"}


class GeneratedWidgetQuery(BaseModel):
    name: str = ""
    conditions: str = Field(
        default="",
        description="Search filter string using Sentry's filter syntax. Multiple terms are implicitly ANDed; use parentheses with OR/AND for explicit boolean logic. Empty string means no filtering.",
    )
    aggregates: list[str] = Field(
        default=[],
        description=(
            """
            Aggregate function or equation expressions to compute. For chart widgets these are
            the Y-axis values; for table widgets they become data columns alongside columns[].
            Valid aggregate function values vary by dataset type. Do not make up functions or
            use unsupported functions.

            For the 'tracemetrics' widget_type, aggregates use a required 4-argument form:
            `func(attribute, metric_name, metric_type, metric_unit)` where attribute must be
            `value` (the numeric value of the metric; no other attributes are supported at this
            time), metric_name is the metric's name as ingested, metric_type is one of
            'counter', 'gauge', or 'distribution', and metric_unit is the metric's unit as
            ingested (e.g. 'milliseconds', 'bytes'); use 'none' only when the metric has no
            unit. Examples: `sum(value, my.app.requests, counter, none)`,
            `avg(value, my.app.cpu, gauge, percent)`,
            `p95(value, my.app.latency, distribution, milliseconds)`.
            Each metric_type only accepts a specific set of aggregate functions, and using a
            function outside that set will fail:

            - counter: sum, per_second, per_minute.
            - gauge: avg, min, max, per_second, per_minute.
            - distribution: p50, p75, p90, p95, p99, avg, min, max, sum, count, per_second,
            per_minute.

            You MUST NOT guess metric_name, metric_type, or metric_unit; look them up first
            using the available tools (e.g. by querying the tracemetrics dataset for distinct
            `metric.name`, `metric.type`, and `metric.unit` values, or fetching trace-item
            attributes).

            Equations are supported via the `equation|<expr>` prefix in the `aggregates` array.
            Equations let you combine aggregates with arithmetic (+, -, *, /).

            Strictly only for the 'tracemetrics' widget_type, the following rules about equations apply:
                - Each aggregate operand in the equation must be a valid 4-argument tracemetric aggregate. Numeric literals are also valid operands.
                - Equations are arbitrary arithmetic expressions — you can chain any number of operands: `equation|<agg1> <op> <agg2> <op> <agg3> ...`
                - Operators: `+` (plus), `-` (minus), `*` (multiply), `/` (divide).
                - Parentheses are supported for grouping and controlling precedence: `equation|(agg1 + agg2) / (agg3 - agg4)`.
                - Examples:
                - `equation|sum(value, my.app.requests, counter, none) / sum(value, my.app.errors, counter, none)`
                - `equation|p95(value, my.app.latency, distribution, milliseconds) - p50(value, my.app.latency, distribution, milliseconds)`
                - `equation|avg(value, my.app.cpu, gauge, percent) * 100`
                - `equation|(sum(value, my.app.requests, counter, none) - sum(value, my.app.errors, counter, none)) / sum(value, my.app.requests, counter, none) * 100`
                - All aggregate functions may also be defined using `_if` to apply a filter condition for that operand and the filter condition
                  is provided as the first argument within backticks (`), which is then followed by the remaining arguments for the typical
                  4-argument tracemetric aggregate.
                    - For example, `equation|sum_if(`environment:prod`,value, my.app.errors, counter, none) / sum_if(`environment:prod`,value, my.app.requests, counter, none)`
                - `per_second` and `per_minute` are not supported in equations, as well as the `_if` variant of these functions.
                - An equation for tracemetrics must be the only entry in the `aggregates` array for a query (the frontend does not support rendering equations alongside aggregates).
            """
        ),
    )
    columns: list[str] = Field(
        default=[],
        description="Non-aggregate group-by columns. For table widgets these become the row-identifier columns; for chart widgets with a breakdown they define the series grouping.",
    )
    fields: list[str] = Field(
        default=[],
        description="Union of aggregates[] and columns[]. Table widgets always include all columns and aggregates in order. Chart widgets always include aggregates and also include columns if there are series group-bys present.",
    )
    orderby: str = Field(
        default="",
        description="Sort expression. Optional leading '-' for descending; absent means ascending. An aggregate expression, column name, or 'equation|<expr>'. Empty string means no explicit sort. For the issue widget type, only 'date', 'new', 'trends', 'freq', and 'user' are allowed values, with no option for descending.",
        example="duration",
    )

    # Fields must always include all columns and aggregates
    @validator("fields", always=True)
    def populate_fields(cls, v: list[str], values: dict[str, Any]) -> list[str]:
        return [*values.get("columns", []), *values.get("aggregates", [])]

    @validator("aggregates", each_item=True)
    def check_blocklist(cls, v: str) -> str:
        func_name = v.split("(")[0]
        if func_name in FUNCTION_BLOCKLIST:
            raise ValueError(f"Function '{func_name}' is not allowed in generated dashboards")
        return v


Polarity = Literal["+", "-"]


class GeneratedWidgetThresholds(BaseModel):
    """Color-coded thresholds for big_number, line, and area chart widgets. max1 and max2 define thresholds for three zones whose color meaning depends on preferred_polarity."""

    max_values: dict[str, float] = Field(
        ...,
        description="Threshold boundaries. Must contain keys 'max1' and 'max2' where max1 < max2. Both values must be non-negative.",
    )
    unit: str | None = Field(
        default=None,
        description="Display unit for threshold values (e.g. 'millisecond', 'percent'). Null means use the widget's default unit.",
    )
    preferred_polarity: Polarity = Field(
        description="Determines color meaning: '+' means higher is better (green above max2), '-' means lower is better (green below max1). Must be '+' or '-'.",
    )

    @validator("max_values")
    def validate_max_values(cls, v: dict[str, float]) -> dict[str, float]:
        allowed_keys = {"max1", "max2"}
        if set(v.keys()) != allowed_keys:
            raise ValueError("max_values must contain exactly 'max1' and 'max2'")
        if v["max1"] < 0 or v["max2"] < 0:
            raise ValueError("Threshold values must be non-negative")
        if v["max1"] >= v["max2"]:
            raise ValueError("max1 must be less than max2")
        return v


class GeneratedWidgetLayout(BaseModel):
    """Layout position and size on a 6-column grid. Widget widths in each row should sum to 6 to fill the grid completely."""

    x: int = Field(
        default=0,
        description=f"Column position (0-{GRID_WIDTH - 1}). x + w must not exceed {GRID_WIDTH}.",
        ge=0,
        le=GRID_WIDTH - 1,
    )
    y: int = Field(default=0, description="Row position (0+).", ge=0)
    w: int = Field(
        default=3,
        description=f"Width in columns (1-{GRID_WIDTH}). x + w must not exceed {GRID_WIDTH}.",
        ge=1,
        le=GRID_WIDTH,
    )
    h: int = Field(
        default=2,
        description="Height in rows (1+). A height of 2 is approximately 256px. For non big_number widgets, this should be at least 2.",
        ge=1,
    )
    min_h: int = Field(default=2, description="Minimum height in rows (1+).")

    @validator("x", pre=True, always=True)
    def clamp_x(cls, v: int) -> int:
        return max(0, min(v, GRID_WIDTH - 1))

    @validator("w", pre=True, always=True)
    def clamp_w(cls, v: int) -> int:
        return max(1, min(v, GRID_WIDTH))

    @validator("h", pre=True, always=True)
    def clamp_h(cls, v: int) -> int:
        return max(1, v)

    @validator("min_h", pre=True, always=True)
    def clamp_min_h(cls, v: int) -> int:
        return max(1, v)

    @validator("w", always=True)
    def fit_within_grid(cls, w: int, values: dict[str, Any]) -> int:
        x = values.get("x", 0)
        if x + w > GRID_WIDTH:
            return GRID_WIDTH - x  # Return the maximum width possible
        return w


class GeneratedWidget(BaseModel):
    """A single dashboard widget. Default sizes by display type: big_number 2w x 1h (3 per row), line/area/bar/top_n 3w x 2h (2 per row), table 6w x 2h (full row)."""

    title: str = Field(..., max_length=255)  # Matches serializer
    description: str = Field(
        ...,
        description="A short description of the widget. This is displayed in the dashboard UI as a hoverable tooltip. For text widget types, this is the markdown text content displayed to the user. Should not exceed 255 characters for non-text widgets.",
    )
    display_type: DisplayType
    widget_type: WidgetType | None = Field(
        ...,
        description="Dataset to query. Use 'spans' as the default — it covers most use cases. Use 'error-events' for error-specific data, 'issue' for issue tracking, 'logs' for log data, 'tracemetrics' for trace metrics. Text widgets do not have a widget_type and should be set to None. Required for non-text widgets.",
    )
    queries: list[GeneratedWidgetQuery] = Field(
        ...,
        description="One query per series/filter on the widget. All queries must share the same `aggregates`, `columns`, and `orderby` — they should only differ by `conditions` and `name`. To plot multiple aggregates (e.g. p50 and p95), put them all in a single query's `aggregates` array rather than creating a query per aggregate.",
    )
    layout: GeneratedWidgetLayout
    limit: int = Field(
        default=5,
        ge=1,
        le=25,
        description="For charts with group by columns, the maximum number series that can be displayed. For table widgets, the maximum number of rows that can be displayed. Categorical bar charts have a maximum limit of 25. For any other chart type, the maximum limit is 10. Default value is 5.",
    )
    interval: Intervals = Field(default="1h")
    thresholds: GeneratedWidgetThresholds | None = Field(
        default=None,
        description="Color-coded thresholds for big_number, line, and area chart widgets. Defines two boundaries (max1 < max2) that split the value into three color zones.",
    )

    @root_validator
    def check_text_widget_constraints(cls, values: dict[str, Any]) -> dict[str, Any]:
        display_type = values.get("display_type")
        is_text = display_type == "text"

        description = values.get("description", "")
        if not is_text and len(description) > 255:
            raise ValueError(
                f"Description must not exceed 255 characters for non-text widgets (got {len(description)})"
            )

        widget_type = values.get("widget_type")
        if not is_text and widget_type is None:
            raise ValueError("widget_type is required for non-text widgets")

        if is_text and widget_type is not None:
            raise ValueError("widget_type is not allowed for text widgets")

        queries = values.get("queries") or []
        if not is_text and not queries:
            raise ValueError("Non-text widgets must have at least one query")

        return values

    @root_validator
    def check_limit_by_display_type(cls, values: dict[str, Any]) -> dict[str, Any]:
        display_type = values.get("display_type")
        limit = values.get("limit")
        if display_type is None or limit is None or display_type == "text":
            return values
        max_limit = get_max_widget_limit(
            DashboardWidgetDisplayTypes.get_id_for_type_name(display_type)
        )
        if limit > max_limit:
            raise ValueError(
                f"limit={limit} exceeds the maximum of {max_limit} for display_type '{display_type}'"
            )
        return values

    @root_validator
    def check_query_consistency(cls, values: dict[str, Any]) -> dict[str, Any]:
        queries = values.get("queries") or []
        if len(queries) <= 1:
            return values

        first_query = queries[0]
        for query in queries[1:]:
            if (
                query.aggregates != first_query.aggregates
                or query.columns != first_query.columns
                or query.orderby != first_query.orderby
            ):
                raise ValueError(
                    "All queries in a widget must share the same aggregates, columns, "
                    "and orderby; queries should only differ by `conditions` and `name`. "
                    "To plot multiple aggregates (e.g. p50 and p95), put them all in a "
                    "single query's `aggregates` array rather than creating a query per aggregate."
                )
        return values


class GeneratedDashboard(BaseModel):
    """A complete dashboard definition on a 6-column grid. Widget widths per row must sum to 6. This is the sole output artifact."""

    title: str = Field(..., max_length=255)  # Matches serializer
    projects: list[int] = Field(
        default=[],
        description='Project ids to scope the dashboard to. Empty list means "My Projects".',
    )
    environment: list[str] = Field(
        default=[],
        description="Environment names to filter by (e.g. ['production', 'staging']). Empty list means all environments.",
    )
    widgets: list[GeneratedWidget] = Field(..., max_items=Dashboard.MAX_WIDGETS)
