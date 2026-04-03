from __future__ import annotations

from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, Field, root_validator, validator

from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import DashboardWidgetDisplayTypes, DashboardWidgetTypes

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
FUNCTION_BLOCKLIST: set[str] = {"spm", "apdex", "http_error_count"}


class GeneratedWidgetQuery(BaseModel):
    name: str = ""
    conditions: str = Field(
        default="",
        description="Search filter string using Sentry's filter syntax. Multiple terms are implicitly ANDed; use parentheses with OR/AND for explicit boolean logic. Empty string means no filtering.",
    )
    aggregates: list[str] = Field(
        default=[],
        description="Aggregate function expressions to compute. For chart widgets these are the Y-axis values; for table widgets they become data columns alongside columns[]. Valid aggregate function values vary by dataset type. Do not make up functions or use unsupported functions.",
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
    """A single dashboard widget. Default sizes by display type: big_number 2w x 1h (3 per row), line/area/bar/stacked_area/top_n 3w x 2h (2 per row), table 6w x 2h (full row)."""

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
    queries: list[GeneratedWidgetQuery]
    layout: GeneratedWidgetLayout
    limit: int = Field(
        default=5,
        ge=1,
        le=25,
        description="For charts with group by columns, the maximum number series that can be displayed. For table widgets, the maximum number of rows that can be displayed. Categorical bar charts have a maximum limit of 25. For any other chart type, the maximum limit is 10. Default value is 5.",
    )
    interval: Intervals = Field(default="1h")

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

        return values


class GeneratedDashboard(BaseModel):
    """A complete dashboard definition on a 6-column grid. Widget widths per row must sum to 6. This is the sole output artifact."""

    title: str = Field(..., max_length=255)  # Matches serializer
    widgets: list[GeneratedWidget] = Field(..., max_items=Dashboard.MAX_WIDGETS)
