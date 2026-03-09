from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, validator

GRID_WIDTH = 6

DisplayType = Literal[
    "line",
    "area",
    "stacked_area",
    "bar",
    "table",
    "big_number",
    "top_n",
]

WidgetType = Literal[
    "issue",
    "error-events",
    "spans",
    "logs",
    "tracemetrics",
]


class GeneratedWidgetQuery(BaseModel):
    name: str = ""
    conditions: str = ""
    fields: list[str] = []
    aggregates: list[str] = []
    columns: list[str] = []
    orderby: str = ""

    @validator("fields", always=True)
    def populate_fields(cls, v: list[str], values: dict) -> list[str]:
        return [*values.get("columns", []), *values.get("aggregates", [])]


class GeneratedWidgetLayout(BaseModel):
    x: int = Field(
        default=0,
        description=f"Column position (0-{GRID_WIDTH - 1}). x + w must not exceed {GRID_WIDTH}.",
    )
    y: int = Field(default=0, description="Row position (0+).")
    w: int = Field(
        default=GRID_WIDTH,
        description=f"Width in columns (1-{GRID_WIDTH}). x + w must not exceed {GRID_WIDTH}.",
    )
    h: int = Field(
        default=2, description="Height in rows (1+). A height of 2 is approximately 256px."
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
    def fit_within_grid(cls, w: int, values: dict) -> int:
        x = values.get("x", 0)
        if x + w > GRID_WIDTH:
            return GRID_WIDTH - x
        return w


class GeneratedWidget(BaseModel):
    title: str
    description: str | None = None
    display_type: DisplayType
    widget_type: WidgetType = "spans"
    queries: list[GeneratedWidgetQuery]
    layout: GeneratedWidgetLayout | None = None
    limit: int | None = Field(default=None, le=10)


class GeneratedDashboard(BaseModel):
    title: str
    widgets: list[GeneratedWidget]
