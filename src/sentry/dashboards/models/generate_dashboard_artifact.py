from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, validator

from sentry.models.dashboard import Dashboard

GRID_WIDTH = 6

# Hardcode maintained lists for now, not all display types are well suited for dashboard generation.
DisplayType = Literal[
    "line",
    "area",
    "stacked_area",
    "bar",
    "table",
    "big_number",
    "top_n",
]

# Hardcode maintained lists for now, not all widget types are well suited for dashboard generation.
WidgetType = Literal[
    "issue",
    "error-events",
    "spans",
    "logs",
    "tracemetrics",
]

Intervals = Literal["5m", "15m", "30m", "1h", "4h", "12h", "24h"]

# Blocklist for frequently hallucinated functions or functions we want to avoid using
FUNCTION_BLOCKLIST: set[str] = {"spm", "apdex"}


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
        description="Sort expression. Optional leading '-' for descending; absent means ascending. An aggregate expression, column name, or 'equation|<expr>'. Empty string means no explicit sort.",
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
        default=2, description="Height in rows (1+). A height of 2 is approximately 256px.", ge=1
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
    title: str = Field(..., max_length=255)  # Matches serializer
    description: str = Field(
        ..., max_length=255
    )  # Length matches serializer, required field for generation
    display_type: DisplayType
    widget_type: WidgetType
    queries: list[GeneratedWidgetQuery]
    layout: GeneratedWidgetLayout
    limit: int | None = Field(default=None, le=10, ge=1)
    interval: Intervals = Field(default="1h")


class GeneratedDashboard(BaseModel):
    title: str = Field(..., max_length=255)  # Matches serializer
    widgets: list[GeneratedWidget] = Field(..., max_items=Dashboard.MAX_WIDGETS)
