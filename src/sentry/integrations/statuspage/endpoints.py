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
class StatuspageDirectApiEndpoint(OrganizationEndpoint):
    """
    Direct API endpoint for hitting Statuspage API.
    WARNING: This bypasses normal integration flow and should only be used for testing.
    """

    permission_classes = (SentryIsAuthenticated,)

    def post(self, request: Request, organization, **kwargs) -> Response:
        """
        Execute a direct Statuspage API call.

        Expected payload:
        {
            "action": "create_component" | "list_components" | "create_incident" | "update_incident",
            "page_id": "uuid",
            "params": {...}
        }
        """
        try:
            action = request.data.get("action")
            page_id = request.data.get("page_id")
            params = request.data.get("params", {})

            if not action or not page_id:
                return Response(
                    {"error": "Missing required fields: action, page_id"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Get Statuspage API key from options
            from sentry import options

            api_key = options.get("statuspage.api-key")

            if not api_key:
                return Response(
                    {"error": "Statuspage API key not configured"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            headers = {
                "Authorization": f"OAuth {api_key}",
                "Content-Type": "application/json",
            }

            if action == "create_component":
                url = f"https://api.statuspage.io/v1/pages/{page_id}/components"
                response = requests.post(url, headers=headers, json=params, timeout=30)

            elif action == "list_components":
                url = f"https://api.statuspage.io/v1/pages/{page_id}/components"
                response = requests.get(url, headers=headers, timeout=30)

            elif action == "create_incident":
                url = f"https://api.statuspage.io/v1/pages/{page_id}/incidents"
                response = requests.post(url, headers=headers, json=params, timeout=30)

            elif action == "update_incident":
                incident_id = params.get("incident_id")
                if not incident_id:
                    return Response(
                        {"error": "Missing incident_id for update_incident"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                url = f"https://api.statuspage.io/v1/pages/{page_id}/incidents/{incident_id}"
                # Remove incident_id from params since it's in the URL
                update_params = {k: v for k, v in params.items() if k != "incident_id"}
                response = requests.put(url, headers=headers, json=update_params, timeout=30)

            else:
                return Response(
                    {"error": f"Unknown action: {action}"}, status=status.HTTP_400_BAD_REQUEST
                )

            response.raise_for_status()
            return Response(response.json())
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
