#!/usr/bin/env python
"""
Example client for Sentry gRPC services using Sonora.

This demonstrates how to use the sentry-grpc-protos package with Sonora
to communicate with Sentry's gRPC services.

Installation:
    pip install sentry-grpc-protos[client]

Or separately:
    pip install sentry-grpc-protos
    pip install sonora
"""

import sys
import os
import hmac
import hashlib
from typing import Optional

# Add the generated protos to path if running from source
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../src/sentry/integrations/grpc/generated'))

try:
    # Try importing from installed package
    from sentry_grpc_protos import scm_pb2, scm_pb2_grpc
except ImportError:
    # Fall back to local imports if package not installed
    import scm_pb2
    import scm_pb2_grpc

from sonora.client import Client, RequestsTransport


class SentryGrpcClient:
    """Example client for Sentry gRPC services using Sonora."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        auth_token: Optional[str] = None,
        hmac_secret: Optional[str] = None
    ):
        """
        Initialize the client.

        Args:
            base_url: Base URL of the Sentry gRPC service
            auth_token: Optional authentication token
            hmac_secret: Optional HMAC secret for service-to-service auth
        """
        self.base_url = base_url
        self.auth_token = auth_token
        self.hmac_secret = hmac_secret

        # Create transport with authentication
        headers = {}
        if auth_token:
            headers["X-Grpc-Auth-Token"] = auth_token

        self.transport = RequestsTransport(
            base_url=base_url,
            headers=headers
        )

        # Create the client
        self.client = Client(
            service_stub=scm_pb2_grpc.ScmServiceStub,
            transport=self.transport
        )

    def _sign_request(self, method: str, request) -> dict:
        """
        Sign a request with HMAC for service-to-service authentication.

        Args:
            method: The RPC method name
            request: The protobuf request object

        Returns:
            Dictionary of headers for HMAC authentication
        """
        if not self.hmac_secret:
            return {}

        # Serialize request to bytes
        body_bytes = request.SerializeToString()
        body_hex = body_bytes.hex()

        # Create signature
        signing_payload = f"{method}:{body_hex}".encode('utf-8')
        signature = hmac.new(
            self.hmac_secret.encode('utf-8'),
            signing_payload,
            hashlib.sha256
        ).hexdigest()

        return {
            "X-Signature": signature,
            "X-Body": body_hex,
            "X-Method": method
        }

    def list_repositories(self, organization_id: int):
        """List repositories for an organization."""
        request = scm_pb2.GetRepositoriesRequest(
            organization_id=organization_id,
            page_size=10
        )

        # If using HMAC auth, update transport headers
        if self.hmac_secret:
            method = "/sentry.integrations.scm.v1.ScmService/GetRepositories"
            hmac_headers = self._sign_request(method, request)
            # For this example, we'd need to update transport headers
            # In production, you'd want to handle this more elegantly

        try:
            response = self.client.GetRepositories(request)
            return response.repositories
        except Exception as e:
            print(f"Error: {e}")
            return []

    def create_issue(
        self,
        organization_id: int,
        integration_id: int,
        title: str,
        description: str
    ):
        """Create an external issue."""
        request = scm_pb2.CreateIssueRequest(
            organization_id=organization_id,
            integration_id=integration_id,
            title=title,
            description=description
        )

        try:
            response = self.client.CreateIssue(request)
            return response.issue
        except Exception as e:
            print(f"Error creating issue: {e}")
            return None

    def check_file(
        self,
        organization_id: int,
        repository_id: int,
        filepath: str,
        branch: Optional[str] = None
    ):
        """Check if a file exists in a repository."""
        request = scm_pb2.CheckFileRequest(
            organization_id=organization_id,
            repository_id=repository_id,
            filepath=filepath,
            branch=branch or ""
        )

        try:
            response = self.client.CheckFile(request)
            return response.exists, response.url
        except Exception as e:
            print(f"Error checking file: {e}")
            return False, ""


def main():
    """Example usage of the Sentry gRPC client."""
    print("Sentry gRPC Client Example")
    print("=" * 50)

    # Create client
    client = SentryGrpcClient(
        base_url="http://localhost:8000",
        auth_token=os.environ.get("SENTRY_GRPC_TOKEN")  # Get token from env
    )

    # Example 1: List repositories
    print("\n1. Listing repositories...")
    repos = client.list_repositories(organization_id=1)
    if repos:
        for repo in repos:
            print(f"  - {repo.name} ({repo.external_id})")
    else:
        print("  No repositories found (or error occurred)")

    # Example 2: Create an issue
    print("\n2. Creating an issue...")
    issue = client.create_issue(
        organization_id=1,
        integration_id=1,
        title="Test Issue from gRPC Client",
        description="This is a test issue created via gRPC"
    )
    if issue:
        print(f"  Created issue: {issue.key} - {issue.title}")
        print(f"  URL: {issue.web_url}")
    else:
        print("  Failed to create issue")

    # Example 3: Check if a file exists
    print("\n3. Checking file existence...")
    exists, url = client.check_file(
        organization_id=1,
        repository_id=1,
        filepath="README.md",
        branch="main"
    )
    if exists:
        print(f"  File exists! URL: {url}")
    else:
        print("  File not found")

    print("\n" + "=" * 50)
    print("Example complete!")


if __name__ == "__main__":
    main()
