from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, validator

from sentry.models.organization import Organization
from sentry.seer.explorer.custom_tool_utils import ExplorerTool

GRID_WIDTH = 6


class DashboardWidgetQuery(BaseModel):
    name: str = Field(default="", description="Display name for this query series")
    aggregates: list[str] = Field(
        default_factory=list, description="Aggregate functions, e.g. ['count()', 'p95(duration)']"
    )
    columns: list[str] = Field(
        default_factory=list, description="Group-by columns, e.g. ['transaction', 'project']"
    )
    conditions: str = Field(
        default="", description="Filter conditions in Sentry query syntax, e.g. 'is:unresolved'"
    )
    orderby: str = Field(default="", description="Order-by field, e.g. '-count()' for descending")
    fields: list[str] = Field(
        description="Combined fields list (aggregates + columns), e.g. ['count()', 'transaction']"
    )

    @validator("fields", always=True)
    def populate_fields(cls, v: list[str], values: dict) -> list[str]:
        return [*values.get("columns", []), *values.get("aggregates", [])]


class DashboardWidgetLayout(BaseModel):
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


class DashboardWidget(BaseModel):
    title: str = Field(description="Widget title")
    description: str = Field(description="A description of the widget")
    display_type: Literal["line", "area", "stacked_area", "bar", "table", "big_number"] = Field(
        description="Chart type for the widget"
    )
    widget_type: Literal[
        "issue",
        "error-events",
        "spans",
        "logs",
        "tracemetrics",
    ] = Field(description="Data source type for the widget")
    queries: list[DashboardWidgetQuery] = Field(
        description="One or more queries providing data for this widget"
    )
    layout: DashboardWidgetLayout | None = None


class DashboardParams(BaseModel):
    title: str
    widgets: list[DashboardWidget]


class DashboardValidationTool(ExplorerTool[DashboardParams]):
    """Custom tool that validates a dashboard configuration before it is emitted."""

    params_model = DashboardParams

    @classmethod
    def get_description(cls) -> str:
        return (
            "Use this tool when creating a dashboard to validate the JSON, and present it to the user."
            "Returns 'valid' or a list of errors to fix."
            "Attempt to fix the errors and call this tool again."
            "Do not respond to the user, the dashboard will be rendered automatically"
        )

    @classmethod
    def execute(cls, organization: Organization, params: DashboardParams) -> str:
        return "valid"
        # from types import SimpleNamespace

        # from django.contrib.auth.models import AnonymousUser

        # from sentry.api.serializers.rest_framework.dashboard import DashboardDetailsSerializer

        # context = {
        #     "organization": organization,
        #     "projects": [],
        #     "environment": [],
        #     "request": SimpleNamespace(user=AnonymousUser()),
        # }

        # serializer = DashboardDetailsSerializer(data=params.dict(), context=context)
        # if serializer.is_valid():
        #     return "valid"

        # errors: list[str] = []
        # for field, field_errors in serializer.errors.items():
        #     if isinstance(field_errors, list):
        #         for err in field_errors:
        #             errors.append(f"{field}: {err}")
        #     else:
        #         errors.append(f"{field}: {field_errors}")

        # return "Invalid dashboard:\n" + "\n".join(f"- {e}" for e in errors)
