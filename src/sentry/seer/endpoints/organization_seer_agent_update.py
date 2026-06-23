from __future__ import annotations

import logging
from typing import Any

import orjson
from rest_framework.permissions import SAFE_METHODS
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ENABLE_SEER_CODING_DEFAULT
from sentry.demo_mode.utils import is_demo_mode_enabled, is_demo_org, is_demo_user
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import (
    agent_connection_pool,
    has_seer_agent_access_with_detail,
)
from sentry.seer.autofix.constants import CODING_PAYLOAD_TYPES
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import make_signed_seer_api_request

logger = logging.getLogger(__name__)


class OrganizationSeerAgentUpdatePermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }

    # Allow POST requests in demo mode to showcase Seer Agent
    DEMO_ALLOWED_METHODS = (*SAFE_METHODS, "POST")

    def has_permission(self, request: Request, view: APIView) -> bool:
        if is_demo_user(request.user):
            if not is_demo_mode_enabled() or request.method not in self.DEMO_ALLOWED_METHODS:
                return False
            return True
        return super().has_permission(request, view)

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if is_demo_user(request.user):
            if not is_demo_mode_enabled() or request.method not in self.DEMO_ALLOWED_METHODS:
                return False
            org = obj.organization if hasattr(obj, "organization") else obj
            if not is_demo_org(org):
                return False
            return True
        return super().has_object_permission(request, view, obj)


@cell_silo_endpoint
class OrganizationSeerAgentUpdateEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerAgentUpdatePermission,)

    def post(self, request: Request, organization: Organization, run_id: int) -> Response:
        """
        Send an update event to the agent for a given run.
        """
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)
        if not has_access:
            return Response({"detail": error}, status=403)

        if not request.data or not isinstance(request.data, dict):
            return Response(status=400, data={"error": "Need a body with a payload"})

        payload = request.data.get("payload", {})
        payload_type = payload.get("type") if isinstance(payload, dict) else None
        if payload_type in CODING_PAYLOAD_TYPES:
            if not organization.get_option(
                "sentry:enable_seer_coding", default=ENABLE_SEER_CODING_DEFAULT
            ):
                return Response(
                    status=403,
                    data={"detail": "Code generation is disabled for this organization"},
                )

        path = "/v1/automation/explorer/update"

        body = orjson.dumps(
            {
                **request.data,
                "run_id": run_id,
                "organization_id": organization.id,
            }
        )

        response = make_signed_seer_api_request(
            agent_connection_pool,
            path,
            body,
        )

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)

        return Response(status=202, data=response.json())
