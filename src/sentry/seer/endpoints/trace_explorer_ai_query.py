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


def send_translate_request(
    org_id: int, org_slug: str, project_ids: list[int], natural_language_query: str
) -> Any:
    """
    Sends a request to seer to create the initial cached prompt / setup the AI models
    """
    body = orjson.dumps(
        {
            "org_id": org_id,
            "org_slug": org_slug,
            "project_ids": project_ids,
            "natural_language_query": natural_language_query,
        }
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/assisted-query/translate",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )
    response.raise_for_status()
    return response.json()


@region_silo_endpoint
class TraceExplorerAIQuery(OrganizationEndpoint):
    """
    This endpoint is called when a user visits the trace explorer with the correct flags enabled.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    permission_classes = (OrganizationTraceExplorerAIPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Request to translate a natural language query into a sentry EQS query.
        """
        if not request.user.is_authenticated:
            return Response(
                {"detail": "User is not authenticated"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_project_ids = request.data.get("project_ids", [])
        projects = self.get_projects(
            request=request,
            organization=organization,
            project_ids={int(x) for x in raw_project_ids} if raw_project_ids else None,
        )
        project_ids = [p.id for p in projects]
        natural_language_query = request.data.get("natural_language_query")
        limit = request.data.get("limit", 1)

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
        data = send_translate_request(
            organization.id, organization.slug, project_ids, natural_language_query
        )

        responses = data.get("responses", [])[:limit]
        unsupported_reason = data.get("unsupported_reason")

        if len(responses) == 0 and not unsupported_reason:
            logger.info("No results found for query")
            return Response(
                {"detail": "No results found for query"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "status": "ok",
                "queries": [
                    {
                        "query": query["query"],
                        "stats_period": query["stats_period"],
                        "group_by": list(query.get("group_by", [])),
                        "visualization": list(query.get("visualization", [])),
                        "sort": query["sort"],
                        "mode": query.get("mode", "spans"),
                    }
                    for query in responses
                ],
                "unsupported_reason": unsupported_reason,
            }
        )
