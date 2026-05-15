from __future__ import annotations

import logging
from typing import Any

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
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json

logger = logging.getLogger(__name__)

CREATE_ON_PAGE_CONTEXT = "The user is on the dashboard generation page. This session must ONLY generate a dashboard artifact. Do not perform code changes or any tasks unrelated to dashboard generation."

EDIT_ON_PAGE_CONTEXT_TEMPLATE = """The user is editing an existing dashboard. The current dashboard state is:

{current_dashboard_json}

This session must ONLY modify the dashboard artifact. Produce a COMPLETE dashboard artifact that incorporates the requested changes while preserving widgets the user did not ask to change. Do not perform code changes or any tasks unrelated to dashboard editing."""

DASHBOARD_INSTRUCTIONS = """\
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

Limits:
- For non-table, non-big_number chart widgets that have group-by columns, limit must be explicitly \
set. The maximum is 10 for most chart types, 25 for categorical bar charts, and 20 for table widgets.

User Query:
"""


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
            run_id = client.start_run(
                prompt=prompt,
                on_page_context=on_page_context,
                artifact_key="dashboard",
                artifact_schema=GeneratedDashboard,
                request=request,
            )
            return Response({"run_id": run_id})
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
        except SeerApiError:
            return Response({"detail": "Seer request failed"}, status=502)
