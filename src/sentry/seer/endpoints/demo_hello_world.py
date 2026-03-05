from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import LlmGenerateRequest, make_llm_generate_request

logger = logging.getLogger(__name__)


class DemoHelloWorldPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


@region_silo_endpoint
class DemoHelloWorldEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (DemoHelloWorldPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        message = request.data.get("message")
        if not message:
            return Response(
                {"detail": "Missing required parameter: message"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            body = LlmGenerateRequest(
                provider="gemini",
                model="flash",
                referrer="sentry.demo-hello-world",
                prompt=message,
                temperature=0.7,
                max_tokens=256,
            )
            response = make_llm_generate_request(body, timeout=10)
            if response.status >= 400:
                raise SeerApiError("Seer request failed", response.status)
            data = response.json()
            return Response({"content": data.get("content")})
        except Exception:
            logger.exception("Failed to call Seer LLM proxy")
            return Response(
                {"detail": "Failed to generate response"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
