from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers.rest_framework import DashboardDetailsSerializer
from sentry.dashboards.models.generate_dashboard_artifact import GeneratedDashboard
from sentry.dashboards.on_completion_hook import DashboardOnCompletionHook
from sentry.models.dashboard import Dashboard
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json

logger = logging.getLogger(__name__)

TRACE_METRICS_GUIDANCE = """When generating widgets with `widget_type: "tracemetrics"`:
- Aggregates use a required 4-argument form: `func(attribute, metric_name, metric_type, metric_unit)`.
  - `attribute` must be `value` (the numeric value of the metric); no other attributes are supported at this time.
  - `metric_name` is the metric's name as ingested (e.g. `my.app.latency`).
  - `metric_type` is exactly one of `counter`, `gauge`, or `distribution`.
  - `metric_unit` is the metric's unit as ingested (e.g. `milliseconds`, `bytes`). Use `none` only when the metric has no unit.
- Each `metric_type` only accepts a specific set of aggregate functions. Using a function not listed for the metric's type will fail:
  - `counter`: `sum`, `per_second`, `per_minute`.
  - `gauge`: `avg`, `min`, `max`, `per_second`, `per_minute`.
  - `distribution`: `p50`, `p75`, `p90`, `p95`, `p99`, `avg`, `min`, `max`, `sum`, `count`, `per_second`, `per_minute`.
- Examples: `sum(value, my.app.requests, counter, none)`, `avg(value, my.app.cpu, gauge, percent)`, `p95(value, my.app.latency, distribution, milliseconds)`.
- Before emitting a tracemetrics widget you MUST look up the metric's `metric_type` AND `metric_unit` using available tools (e.g. by querying the tracemetrics dataset for distinct `metric.name`/`metric.type`/`metric.unit` values, or fetching trace-item attributes). Do NOT guess the type or unit — if you cannot confirm both, pick a different dataset or omit the widget.
- Equations are supported via the `equation|<expr>` prefix in the `aggregates` array.
    - Equations let you combine aggregates with arithmetic (+, -, *, /).
    - Numeric literals (e.g. `100`, `1000`) are valid operands.
    - Each aggregate operand in the equation must be a valid 4-argument tracemetric aggregate. Numeric literals are also valid operands.
    - Equations are arbitrary arithmetic expressions — you can chain any number of operands: `equation|<agg1> <op> <agg2> <op> <agg3> ...`
    - Operators: `+` (plus), `-` (minus), `*` (multiply), `/` (divide).
    - Parentheses are supported for grouping and controlling precedence: `equation|(agg1 + agg2) / (agg3 - agg4)`.
    - Examples:
        - `equation|sum(value, my.app.requests, counter, none) / sum(value, my.app.errors, counter, none)`
        - `equation|p95(value, my.app.latency, distribution, milliseconds) - p50(value, my.app.latency, distribution, milliseconds)`
        - `equation|avg(value, my.app.cpu, gauge, percent) * 100`
        - `equation|(sum(value, my.app.requests, counter, none) - sum(value, my.app.errors, counter, none)) / sum(value, my.app.requests, counter, none) * 100`
    - All aggregate functions support an `_if` variant that takes a backtick-wrapped search query as the first argument, followed by the standard 4 arguments (5 args total)
        - For example, `equation|sum_if(`environment:prod`, value, my.app.errors, counter, none) / sum_if(`environment:prod`, value, my.app.requests, counter, none)`
    - `per_second` and `per_minute` are not supported in equations, as well as the `_if` variant of these functions.
    - An equation for tracemetrics must be the only entry in the `aggregates` array for a query (the frontend does not support rendering equations alongside aggregates).
"""

CREATE_ON_PAGE_CONTEXT = (
    "The user is on the dashboard generation page. This session must ONLY generate a dashboard "
    "artifact. Do not perform code changes or any tasks unrelated to dashboard generation.\n\n"
    + TRACE_METRICS_GUIDANCE
)

EDIT_ON_PAGE_CONTEXT_TEMPLATE = (
    """The user is editing an existing dashboard. The current dashboard state is:

{current_dashboard_json}

This session must ONLY modify the dashboard artifact. Produce a COMPLETE dashboard artifact that incorporates the requested changes while preserving widgets the user did not ask to change. Do not perform code changes or any tasks unrelated to dashboard editing.

"""
    + TRACE_METRICS_GUIDANCE
)

DASHBOARD_INSTRUCTIONS = f"""\
You are generating a Sentry dashboard. Follow these rules strictly:

Data accuracy:
- Every field name, span description, span op, tag key, or attribute value you use in a widget \
query must either come from an actual tool call result or be a field documented in the system prompt.
- Do not invent or guess values that have not been confirmed via a tool call or the system prompt.

Grid layout (6-column grid):
- The grid is 6 columns wide. Every widget's x + w must be <= 6.
- Each row of widgets should have widths that sum to exactly 6.

Queries:
- All queries on a single widget must share the same aggregates, fields, columns, and orderby. Only \
conditions and name may differ between queries on the same widget.
- Never use these aggregate functions — they are denylisted: spm, apdex, http_error_count, \
http_error_count_percent.
- Do not use widget_type "discover" or "transaction-like" — they are deprecated. Use "spans" or \
"error-events" instead.

Widget-type-specific rules:
- For text widgets, widget_type must be null and queries must be empty.
- Description must not exceed 255 characters for non-text widgets. For text widgets,
description must not exceed 15,000 characters.
- For heatmap widgets (display_type "heatmap"):
  - widget_type must be "tracemetrics"; heatmaps are not supported on any other dataset.
  - Use exactly one filter (one query) with exactly one aggregate.
  - That aggregate must use the "count" function over a distribution-type trace metric, \
in the 4-argument tracemetric form: count(value, <metric_name>, distribution, <metric_unit>). \
Only "count" is supported; counter and gauge metrics are not.
  - Do not use equations, group-by columns, or thresholds.

Limits:
- A dashboard can have at most {Dashboard.MAX_WIDGETS} widgets.
- For non-table, non-big_number chart widgets that have group-by columns, limit must be explicitly \
set. The maximum is 10 for most chart types, 25 for categorical bar charts, and 20 for table widgets.

User Query:
"""


class DashboardGenerateResponse(BaseModel):
    run_id: int
    sentry_run_id: str


class DashboardGenerateSerializer(serializers.Serializer[dict[str, Any]]):
    prompt = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="Natural language description of the dashboard to generate or edit.",
    )
    current_dashboard = serializers.JSONField(
        required=False,
        default=None,
        help_text="JSON representation of the current dashboard state to edit.",
    )


class OrganizationDashboardGeneratePermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationDashboardGenerateEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.DASHBOARDS
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=10, window=60),
                RateLimitCategory.USER: RateLimit(limit=10, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=60, window=60 * 60),
            },
        }
    )
    permission_classes = (OrganizationDashboardGeneratePermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:dashboards-ai-generate", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        has_access, error = has_seer_access_with_detail(organization, request.user)
        if not has_access:
            raise PermissionDenied(error)

        serializer = DashboardGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data
        prompt = DASHBOARD_INSTRUCTIONS + validated_data["prompt"] + "\n"
        current_dashboard = validated_data.get("current_dashboard")

        # If current_dashboard is provided, we're editing; otherwise generating a new dashboard.
        if current_dashboard is not None:
            dashboard_serializer = DashboardDetailsSerializer(
                data=current_dashboard,
                context={
                    "organization": organization,
                    "request": request,
                    "projects": self.get_projects(request, organization),
                },
            )
            if not dashboard_serializer.is_valid():
                return Response(dashboard_serializer.errors, status=400)

            on_page_context = EDIT_ON_PAGE_CONTEXT_TEMPLATE.format(
                current_dashboard_json=json.dumps(current_dashboard)
            )
        else:
            on_page_context = CREATE_ON_PAGE_CONTEXT

        try:
            client = SeerAgentClient(
                organization,
                request.user,
                on_completion_hook=DashboardOnCompletionHook,
                category_key="dashboard_generate",
                category_value=str(organization.id),
                reasoning_effort="medium",
            )
            run = client.start_run(
                prompt=prompt,
                on_page_context=on_page_context,
                artifact_key="dashboard",
                artifact_schema=GeneratedDashboard,
                request=request,
            )
            return Response(
                DashboardGenerateResponse(
                    run_id=run.seer_run_state_id, sentry_run_id=str(run.uuid)
                ).dict()
            )
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
        except SeerApiError:
            return Response({"detail": "Seer request failed"}, status=502)
