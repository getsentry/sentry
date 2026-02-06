from __future__ import annotations

import logging

import orjson
import requests
from django.conf import settings
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import sign_with_seer_secret

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful assistant that generates concise, descriptive titles for issue search views in Sentry.
Given a search query, generate a short title (3-6 words) that describes what issues this search finds.
The title should be human-readable and describe the intent of the search, not the syntax.
Do not include quotes or special characters. Return only the title, nothing else."""

MAX_QUERY_LENGTH = 500


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

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/llm/generate",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("content")


@region_silo_endpoint
class IssueViewTitleGenerateEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

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
        except requests.RequestException:
            logger.exception("Failed to call Seer LLM proxy")
            return Response(
                {"detail": "Failed to generate title"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
