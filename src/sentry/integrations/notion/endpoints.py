from __future__ import annotations

import logging

import requests
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.permissions import SentryIsAuthenticated

logger = logging.getLogger(__name__)


@region_silo_endpoint
class NotionDirectApiEndpoint(OrganizationEndpoint):
    """
    Direct API endpoint for hitting Notion API.
    WARNING: This bypasses normal integration flow and should only be used for testing.
    """

    permission_classes = (SentryIsAuthenticated,)

    def post(self, request: Request, organization, **kwargs) -> Response:
        """
        Execute a direct Notion API call.

        Expected payload:
        {
            "action": "query_database" | "update_database" | "retreive_database",
            "database_id": "uuid",
            "params": {...}
        }
        """
        try:
            action = request.data.get("action")
            database_id = request.data.get("database_id")
            params = request.data.get("params", {})

            if not action or not database_id:
                return Response(
                    {"error": "Missing required fields: action, database_id"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Get Notion API token from options
            from sentry import options

            api_key = options.get("notion.integration-token")

            if not api_key:
                return Response(
                    {"error": "Notion API key not configured"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Notion-Version": "2022-06-28",
            }

            if action == "query_database":
                url = f"https://api.notion.com/v1/databases/{database_id}/query"
                response = requests.post(url, headers=headers, json=params, timeout=30)

            elif action == "update_database":
                url = f"https://api.notion.com/v1/databases/{database_id}"
                response = requests.patch(url, headers=headers, json=params, timeout=30)

            elif action == "retreive_database":
                url = f"https://api.notion.com/v1/databases/{database_id}"
                response = requests.get(url, headers=headers, timeout=30)

            else:
                return Response(
                    {"error": f"Unknown action: {action}"}, status=status.HTTP_400_BAD_REQUEST
                )

            response.raise_for_status()
            return Response(response.json())

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
