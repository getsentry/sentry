import requests
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint


@region_silo_endpoint
class EmergeSnapshotsEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization) -> Response:
        """
        Proxy requests to Emerge Tools API to avoid CORS issues.
        """
        # Hardcoded credentials - in production, these should be stored securely
        import os

        EMERGE_API_TOKEN = os.environ.get("EMERGE_API_TOKEN")
        if not EMERGE_API_TOKEN:
            return Response({"error": "EMERGE_API_TOKEN environment variable not set"}, status=500)

        # Get query parameters from the request
        head_upload_id = request.GET.get("headUploadId")
        base_upload_id = request.GET.get("baseUploadId")
        tab = request.GET.get("tab", "changed")
        search = request.GET.get("search")
        page = request.GET.get("page", "0")

        if not head_upload_id:
            return Response({"error": "headUploadId is required"}, status=400)

        # Build query parameters for Emerge API
        params = {
            "headUploadId": head_upload_id,
        }

        if base_upload_id:
            params["baseUploadId"] = base_upload_id
        if tab:
            params["tab"] = tab
        if search:
            params["search"] = search
        if page:
            params["page"] = page

        try:
            # Make request to Emerge Tools API
            response = requests.get(
                "https://api.emergetools.com/internalSnapshotsDiff",
                params=params,
                headers={
                    "X-API-TOKEN": f"{EMERGE_API_TOKEN}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )

            if response.status_code == 200:
                return Response(response.json())
            else:
                return Response(
                    {"error": f"Emerge API returned status {response.status_code}"},
                    status=response.status_code,
                )

        except requests.exceptions.RequestException as e:
            return Response({"error": f"Failed to connect to Emerge API: {str(e)}"}, status=500)
