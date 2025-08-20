from __future__ import annotations

import base64

from requests import PreparedRequest

from sentry.integrations.source_code_management.code_store import CodeStoreClient
from sentry.shared_integrations.client.proxy import IntegrationProxyClient

from .depot import PerforceDepot
from .models import PerforceFileInfo


class PerforceClient(IntegrationProxyClient, CodeStoreClient):
    """
    P4 Code Review Files REST API client using v11 APIs.

    This client is designed to work with P4 Code Review's v11 Files REST API
    to retrieve file contents from Perforce repositories.
    """

    integration_name = "perforce"

    def __init__(self, base_url: str, username: str, password: str, verify_ssl: bool = True):
        super().__init__(verify_ssl=verify_ssl)
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password

    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """Add basic authentication to all requests."""
        # Create basic auth header
        credentials = f"{self.username}:{self.password}"
        encoded_credentials = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
        prepared_request.headers["Authorization"] = f"Basic {encoded_credentials}"
        prepared_request.headers["Accept"] = "application/json"
        return prepared_request

    def get_file_content(self, depot_path: str, revision: int | None = None) -> str:
        """
        Get file contents from Perforce via P4 Code Review v11 Files REST API.

        Args:
            depot_path: File path in the Perforce depot (e.g. //depot/path/to/file.py)
            revision_range: Tuple of (start_revision, end_revision) for Perforce range (e.g. ("123", "456"))

        Returns:
            File contents as string
        """
        depot = PerforceDepot(depot_path)
        encoded_path = depot.encode_path()

        # P4 Code Review v11 API endpoint for file contents
        # URL format: /api/v11/files/{base64_encoded_path}?content=1
        api_path = f"/api/v11/files/{encoded_path}"
        params = {"content": "1"}
        if revision:
            params["fileRevision"] = base64.b64encode(f"#{revision}".encode()).decode("utf-8")

        # Get raw file contents
        response = self.get(api_path, params=params, raw_response=True)

        if isinstance(response, bytes):
            return response.decode("utf-8")
        return str(response)

    def check_file(self, depot_path: str, revision: int | None = None) -> bool:
        """
        Check if a file exists in the Perforce repository using v11 API.

        Args:
            depot_path: File path in the Perforce depot
            revision_range: Tuple of (start_revision, end_revision) for Perforce range

        Returns:
            True if file exists, False otherwise
        """
        try:
            depot = PerforceDepot(depot_path)
            encoded_path = depot.encode_path()

            # P4 Code Review v11 API endpoint for file information
            api_path = f"/api/v11/files/{encoded_path}"
            params = {}
            if revision:
                params["fileRevision"] = base64.b64encode(f"#{revision}".encode()).decode("utf-8")

            response = self.get(api_path, params=params)
            return response is not None
        except Exception:
            return False

    def get_file_info(
        self, depot_path: str, revision: int | None = None
    ) -> PerforceFileInfo | None:
        """
        Get file information from P4 Code Review v11 API.

        Args:
            depot_path: File path in the Perforce depot
            revision_range: Tuple of (start_revision, end_revision) for Perforce range

        Returns:
            PerforceFileInfo instance or None if file doesn't exist
        """
        try:
            depot = PerforceDepot(depot_path)
            encoded_path = depot.encode_path()

            api_path = f"/api/v11/files/{encoded_path}"
            params = {}
            if revision:
                params["fileRevision"] = base64.b64encode(f"#{revision}".encode()).decode("utf-8")

            response = self.get(api_path, params=params)
            return PerforceFileInfo.from_api_response(response) if response else None
        except Exception:
            return None
