from __future__ import annotations

import logging

import orjson
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful assistant that generates concise, descriptive titles for issue search views in Sentry.
Given a search query, generate a short title (3-6 words) that describes what issues this search finds.
The title should be human-readable and describe the intent of the search, not the syntax.
Do not include quotes or special characters. Return only the title, nothing else."""

MAX_QUERY_LENGTH = 500


class IssueViewTitleGeneratePermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


def generate_title_from_query(query: str) -> str | None:
    truncated_query = query[:MAX_QUERY_LENGTH] if len(query) > MAX_QUERY_LENGTH else query

    body = orjson.dumps(
        {
            "provider": "gemini",
            "model": "flash",
            "referrer": "sentry.issue-views.title-generate",
            "prompt": f"Generate a title for this Sentry issue search query: {truncated_query}",
            "system_prompt": SYSTEM_PROMPT,
            "temperature": 0.3,
            "max_tokens": 50,
        }
    )

    response = make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/llm/generate",
        body,
        timeout=10,
    )
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
    data = response.json()
    return data.get("content")


@region_silo_endpoint
class IssueViewTitleGenerateEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (IssueViewTitleGeneratePermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        query = request.data.get("query")
        if not query:
            return Response(
                {"detail": "Missing required parameter: query"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if organization.get_option("sentry:hide_ai_features", False):
            return Response(
                {"detail": "AI features are disabled for this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not features.has(
            "organizations:issue-view-ai-title", organization=organization, actor=request.user
        ):
            return Response(
                {"detail": "Organization does not have access to this feature"},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            title = generate_title_from_query(query)
            if not title:
                return Response(
                    {"detail": "Failed to generate title"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response({"title": title.strip()})
        except Exception:
            logger.exception("Failed to call Seer LLM proxy")
            return Response(
                {"detail": "Failed to generate title"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
