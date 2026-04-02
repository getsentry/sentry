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
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json

logger = logging.getLogger(__name__)

CREATE_ON_PAGE_CONTEXT = "The user is on the dashboard generation page. This session must ONLY generate a dashboard artifact. Do not perform code changes or any tasks unrelated to dashboard generation."

EDIT_ON_PAGE_CONTEXT_TEMPLATE = """The user is editing an existing dashboard. The current dashboard state is:

{current_dashboard_json}

This session must ONLY modify the dashboard artifact. Produce a COMPLETE dashboard artifact that incorporates the requested changes while preserving widgets the user did not ask to change. Do not perform code changes or any tasks unrelated to dashboard editing."""


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
        prompt = validated_data["prompt"]
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
            client = SeerExplorerClient(
                organization,
                request.user,
                on_completion_hook=DashboardOnCompletionHook,
                category_key="dashboard_generate",
                category_value=str(organization.id),
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
