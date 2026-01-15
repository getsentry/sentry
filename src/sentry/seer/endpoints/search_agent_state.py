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
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import sign_with_seer_secret

logger = logging.getLogger(__name__)


def fetch_search_agent_state(run_id: int, organization_id: int) -> dict[str, Any]:
    """
    Fetch the current state of a search agent run from Seer.

    Calls POST /v1/assisted-query/state with the run_id and organization_id.
    """
    body = orjson.dumps({"run_id": run_id, "organization_id": organization_id})

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/assisted-query/state",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )
    response.raise_for_status()
    return response.json()


@region_silo_endpoint
class SearchAgentStateEndpoint(OrganizationEndpoint):
    """
    Endpoint to poll for search agent state by run_id.

    This returns the current state of a search agent run, including:
    - status: processing, completed, or error
    - current_step: the step currently being processed (if any)
    - completed_steps: list of completed steps
    - final_response: the translated query result (when completed)
    - unsupported_reason: error message (when status is error)
    """

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    permission_classes = (OrganizationTraceExplorerAIPermission,)

    def get(self, request: Request, organization: Organization, run_id: str) -> Response:
        """
        Get the current state of a search agent run.

        Args:
            run_id: The run ID returned from /search-agent/start/

        Returns:
            {
                "session": {
                    "run_id": int,
                    "status": "processing" | "completed" | "error",
                    "current_step": {"key": str} | null,
                    "completed_steps": [{"key": str}, ...],
                    "updated_at": str,
                    "final_response": {...} | null,  // Present when completed
                    "unsupported_reason": str | null  // Present on error
                }
            }
        """
        if not features.has(
            "organizations:gen-ai-search-agent-translate", organization, actor=request.user
        ):
            return Response(
                {"detail": "Feature flag not enabled"},
                status=status.HTTP_403_FORBIDDEN,
            )

        has_seer_access, detail = has_seer_access_with_detail(organization, actor=request.user)
        if not has_seer_access:
            return Response(
                {"detail": detail},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            run_id_int = int(run_id)
        except ValueError:
            return Response(
                {"detail": "Invalid run_id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = fetch_search_agent_state(run_id_int, organization.id)

            # Return the session data directly from Seer
            return Response(data)

        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                logger.warning(
                    "search_agent.state_not_found",
                    extra={"run_id": run_id_int},
                )
                return Response(
                    {"session": None},
                    status=status.HTTP_404_NOT_FOUND,
                )
            logger.exception(
                "search_agent.state_error",
                extra={"run_id": run_id_int},
            )
            return Response(
                {"detail": "Failed to fetch run state"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception:
            logger.exception(
                "search_agent.state_error",
                extra={"run_id": run_id_int},
            )
            return Response(
                {"detail": "Failed to fetch run state"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
