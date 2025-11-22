#!/usr/bin/env python
"""Test gRPC-Web client for SCM service."""

import struct
import sys
from typing import Optional

import requests

# Add generated proto path
sys.path.insert(0, "/Users/mikeihbe/code/sentry/src/sentry/integrations/grpc/generated")
import scm_pb2


class GrpcWebClient:
    """Simple gRPC-Web client for testing."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url

    def call_unary(
        self,
        service: str,
        method: str,
        request_message,
        response_class,
        headers: dict | None = None,
    ):
        """Make a unary gRPC-Web call."""
        # Serialize the request
        message_bytes = request_message.SerializeToString()

        # Create gRPC-Web format: 1 byte flags (0x00 = uncompressed), 4 bytes length, then message
        grpc_web_payload = struct.pack("!BI", 0, len(message_bytes)) + message_bytes

        # Build URL - NO trailing slash for gRPC endpoints
        url = f"{self.base_url}/{service}/{method}"
        print(f"Calling: {url}")

        # Prepare headers
        req_headers = {
            "Content-Type": "application/grpc-web+proto",
            "Content-Length": str(len(grpc_web_payload)),
        }
        if headers:
            req_headers.update(headers)

        # Make the request
        response = requests.post(
            url, data=grpc_web_payload, headers=req_headers, allow_redirects=False
        )

        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")

        # Check for gRPC response
        if "grpc" in response.headers.get("content-type", "").lower():
            # Parse gRPC-Web response
            grpc_status = response.headers.get("grpc-status", "0")

            if grpc_status == "0" and response.content:
                # Success - parse the response
                if len(response.content) >= 5:
                    # Skip the framing bytes (1 byte flag + 4 bytes length)
                    message_data = response.content[5:]
                    result = response_class()
                    if message_data:  # Only parse if there's actual data
                        result.ParseFromString(message_data)
                    return result, grpc_status
                else:
                    # Empty successful response
                    return response_class(), grpc_status
            else:
                # Error or empty response
                return None, grpc_status
        else:
            print(f"Non-gRPC response: {response.text[:500]}")
            return None, None


def test_list_repositories():
    """Test ListRepositories method."""
    client = GrpcWebClient()

    # Create request
    request = scm_pb2.ListRepositoriesRequest(organization_id=1, page_size=10)

    print("\n=== Testing ListRepositories ===")
    result, grpc_status = client.call_unary(
        "sentry.integrations.scm.v1.ScmService",
        "ListRepositories",
        request,
        scm_pb2.ListRepositoriesResponse,
    )

    if result:
        print(f"✓ Success! Got {len(result.repositories)} repositories")
        for repo in result.repositories:
            print(f"  - {repo.name} ({repo.provider})")
    elif grpc_status == "16":
        print("✗ Authentication required (expected in development)")
    else:
        print(f"✗ Failed with gRPC status: {grpc_status}")


def test_get_repository():
    """Test GetRepository method."""
    client = GrpcWebClient()

    # Create request (only needs repository_id)
    request = scm_pb2.GetRepositoryRequest(repository_id=1)

    print("\n=== Testing GetRepository ===")
    result, grpc_status = client.call_unary(
        "sentry.integrations.scm.v1.ScmService",
        "GetRepository",
        request,
        scm_pb2.Repository,  # Returns Repository directly, not a response wrapper
    )

    if result and result.name:
        print(f"✓ Success! Got repository: {result.name}")
    elif grpc_status == "16":
        print("✗ Authentication required (expected in development)")
    elif grpc_status == "0":
        print("✓ Success! (but no repository found with ID 1)")
    else:
        print(f"✗ Failed with gRPC status: {grpc_status}")


def test_with_api_key():
    """Test with API key authentication."""
    client = GrpcWebClient()

    # You would need a valid API key for this to work
    api_key = "your-api-key-here"

    request = scm_pb2.ListRepositoriesRequest(organization_id=1, page_size=10)

    print("\n=== Testing with API Key ===")
    result, grpc_status = client.call_unary(
        "sentry.integrations.scm.v1.ScmService",
        "ListRepositories",
        request,
        scm_pb2.ListRepositoriesResponse,
        headers={"X-API-Key": api_key},
    )

    if result:
        print(f"✓ Success! Authenticated and got {len(result.repositories)} repositories")
    elif grpc_status == "16":
        print("✗ Authentication failed (need valid API key)")
    else:
        print(f"✗ Failed with gRPC status: {grpc_status}")


def main():
    """Run all tests."""
    print("Testing gRPC-Web integration...")
    print("=" * 50)

    test_list_repositories()
    test_get_repository()
    # test_with_api_key()  # Uncomment if you have a valid API key

    print("\n" + "=" * 50)
    print("Tests complete!")


if __name__ == "__main__":
    main()
