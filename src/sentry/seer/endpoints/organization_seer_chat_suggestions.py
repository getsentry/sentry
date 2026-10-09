from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import to_valid_int_id
from sentry.dashboards.endpoints.organization_dashboards import OrganizationDashboardsPermission
from sentry.models.dashboard import Dashboard
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.endpoints.organization_seer_agent_chat import (
    OrganizationSeerAgentChatPermission,
)
from sentry.seer.oneshot import run_oneshot
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics
from sentry.workflow_engine.endpoints.organization_detector_details import (
    _check_metric_detector_allowed,
)
from sentry.workflow_engine.endpoints.validators.utils import (
    ORGANIZATION_WORKFLOW_WRITE_SCOPES,
    can_edit_detector,
    can_edit_workflows,
    enforce_workflow_access,
    should_include_all_projects_detector,
)
from sentry.workflow_engine.models import Detector, Workflow

logger = logging.getLogger(__name__)

MAX_PAGE_CONTEXT_LENGTH = 50_000
MAX_PROJECTS = 10


class ChatSuggestion(BaseModel):
    text: str
    kind: Literal["question", "action"]
    action_type: str | None = None


class ChatSuggestionsResult(BaseModel):
    suggestions: list[ChatSuggestion]


class ChatSuggestionsSerializer(serializers.Serializer):
    route = serializers.CharField(allow_blank=True)
    page_context = serializers.CharField(allow_blank=True, trim_whitespace=False)
    project_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    route_params = serializers.DictField(
        child=serializers.CharField(), required=False, default=dict
    )


@cell_silo_endpoint
class OrganizationSeerChatSuggestionsEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=30, window=60),
                RateLimitCategory.USER: RateLimit(limit=30, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            },
        }
    )
    permission_classes = (OrganizationSeerAgentChatPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Generate suggested prompts for the Seer Agent chat empty state from the user's page.
        """
        if not features.has(
            "organizations:seer-chat-suggestions", organization, actor=request.user
        ):
            raise PermissionDenied("Your organization does not have access to this feature.")

        has_access, error = has_seer_agent_access_with_detail(organization, request.user)
        if not has_access:
            raise PermissionDenied(error)

        serializer = ChatSuggestionsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = dict(serializer.validated_data)
        route_params = data.pop("route_params")
        projects = self.get_projects(
            request, organization, project_ids=set(data.pop("project_ids"))
        )
        payload = {
            **data,
            "page_context": data["page_context"][:MAX_PAGE_CONTEXT_LENGTH],
            "projects": [
                {"slug": project.slug, "platform": project.platform}
                for project in sorted(projects, key=lambda project: project.slug)[:MAX_PROJECTS]
            ],
            "code_mode": features.has(
                "organizations:seer-explorer-code-mode-tools", organization, actor=request.user
            ),
            # Whether the user has permission to create alerts and monitors.
            "can_create_alerts": any(
                request.access.has_scope(scope) for scope in ORGANIZATION_WORKFLOW_WRITE_SCOPES
            ),
            # The page's context node type (e.g. "dashboard"), if the user can edit its item.
            "can_edit_node_type": self._can_edit_node_type(request, organization, route_params),
        }

        try:
            result = run_oneshot(
                "chat_suggestions",
                payload,
                organization,
                user_id=request.user.id,
                timeout=3.5,
            )
            suggestions = ChatSuggestionsResult.parse_obj(result).suggestions
        except Exception:
            logger.exception("seer.chat_suggestions.failed")
            metrics.incr("seer.chat_suggestions", tags={"result": "request_error"})
            return Response({"detail": "Failed to generate suggestions"}, status=502)

        metrics.incr(
            "seer.chat_suggestions", tags={"result": "success" if suggestions else "empty"}
        )
        return Response({"suggestions": [s.dict() for s in suggestions]})

    def _can_edit_node_type(
        self,
        request: Request,
        organization: Organization,
        route_params: dict[str, str],
    ) -> str | None:
        """The page's context node type, if the user can edit the item on that page."""
        if dashboard_id := _to_valid_int_id("dashboardId", route_params.get("dashboardId")):
            dashboard = Dashboard.objects.filter(
                id=dashboard_id, organization_id=organization.id
            ).first()
            if dashboard and OrganizationDashboardsPermission().has_object_permission(
                request, self, dashboard
            ):
                return "dashboard"

        elif workflow_id := _to_valid_int_id("automationId", route_params.get("automationId")):
            workflow = Workflow.objects.filter(
                id=workflow_id, organization_id=organization.id
            ).first()
            if workflow:
                try:
                    enforce_workflow_access(workflow, organization, request)
                except PermissionDenied:
                    return None
                if can_edit_workflows([workflow], request):
                    return "alert-detail"

        elif detector_id := _to_valid_int_id("detectorId", route_params.get("detectorId")):
            detector = (
                Detector.objects.by_organization(organization.id)
                .with_type_filters()
                .select_related("project")
                .filter(id=detector_id)
                .first()
            )
            if detector is None:
                return None

            if detector.project is None:
                if not should_include_all_projects_detector(
                    organization=organization, request=request
                ):
                    return None
            elif not request.access.has_project_access(detector.project):
                return None

            try:
                _check_metric_detector_allowed(detector, organization)
            except ResourceDoesNotExist:
                return None
            if can_edit_detector(detector, request):
                return "monitor-detail"

        return None


def _to_valid_int_id(name: str, value: str | None) -> int | None:
    """Like `to_valid_int_id`, but returns None for a missing or invalid id."""
    if value is None:
        return None
    try:
        return to_valid_int_id(name, value)
    except DRFValidationError:
        return None
