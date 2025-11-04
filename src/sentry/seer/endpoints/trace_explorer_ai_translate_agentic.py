from __future__ import annotations

import logging
from typing import Any

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
from sentry.seer.endpoints.trace_explorer_ai_setup import OrganizationTraceExplorerAIPermission
from sentry.seer.signed_seer_api import sign_with_seer_secret

logger = logging.getLogger(__name__)


def send_translate_agentic_request(
    org_id: int,
    org_slug: str,
    project_ids: list[int],
    natural_language_query: str,
    strategy: str = "TRACES",
    model_name: str | None = None,
) -> Any:
    """
    Sends a request to seer to translate a natural language query using the agentic search API.
    """
    body_dict: dict[str, Any] = {
        "org_id": org_id,
        "org_slug": org_slug,
        "project_ids": project_ids,
        "natural_language_query": natural_language_query,
        "strategy": strategy,
    }

    options: dict[str, Any] = {}
    if model_name is not None:
        options["model_name"] = model_name

    if options:
        body_dict["options"] = options

    body = orjson.dumps(body_dict)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/assisted-query/translate-agentic",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )
    response.raise_for_status()
    return response.json()


@region_silo_endpoint
class SearchAgentTranslateEndpoint(OrganizationEndpoint):
    """
    Endpoint to call Seer's agentic search API for translating natural language queries.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    permission_classes = (OrganizationTraceExplorerAIPermission,)

    @staticmethod
    def post(request: Request, organization: Organization) -> Response:
        """
        Request to translate a natural language query using the agentic search API.
        """
        if not request.user.is_authenticated:
            return Response(
                {"detail": "User is not authenticated"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project_ids = [int(x) for x in request.data.get("project_ids", [])]
        natural_language_query = request.data.get("natural_language_query")
        strategy = request.data.get("strategy", "Traces")
        model_name = request.data.get("options", {}).get("model_name")

        if len(project_ids) == 0 or not natural_language_query:
            return Response(
                {
                    "detail": "Missing one or more required parameters: project_ids, natural_language_query"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if organization.get_option("sentry:hide_ai_features", False):
            return Response(
                {"detail": "AI features are disabled for this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not features.has(
            "organizations:seer-explorer", organization=organization, actor=request.user
        ) or not features.has(
            "organizations:gen-ai-features", organization=organization, actor=request.user
        ):
            return Response(
                {"detail": "Organization does not have access to this feature"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not settings.SEER_AUTOFIX_URL:
            return Response(
                {"detail": "Seer is not properly configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            data = send_translate_agentic_request(
                organization.id,
                organization.slug,
                project_ids,
                natural_language_query,
                strategy=strategy,
                model_name=model_name,
            )
            return Response(data)
        except requests.exceptions.RequestException as e:
            return Response(
                {"detail": f"Failed to call Seer API: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
