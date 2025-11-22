#!/usr/bin/env python
"""Test actual gRPC server with proper request."""

import struct
import sys

import requests

sys.path.insert(0, "/Users/mikeihbe/code/sentry/src/sentry/integrations/grpc/generated")
import scm_pb2

# Create a proper gRPC-Web request
request = scm_pb2.ListRepositoriesRequest(organization_id=1, page_size=10)

# Serialize the request
message_bytes = request.SerializeToString()
print(f"Request message: {message_bytes.hex()}")

# gRPC-Web format: 1 byte flags (0x00 = uncompressed), 4 bytes length, then message
grpc_web_payload = struct.pack("!BI", 0, len(message_bytes)) + message_bytes
print(f"gRPC-Web payload: {grpc_web_payload.hex()}")
print(f"Payload length: {len(grpc_web_payload)}")

# Try different URL patterns
urls = [
    "http://localhost:8000/sentry.integrations.scm.v1.ScmService/ListRepositories",
    "http://localhost:8000/sentry.integrations.scm.v1.ScmService/ListRepositories/",
]

for url in urls:
    print(f"\nTrying URL: {url}")

    response = requests.post(
        url,
        data=grpc_web_payload,
        headers={
            "Content-Type": "application/grpc-web+proto",
            "Content-Length": str(len(grpc_web_payload)),
        },
        allow_redirects=False,  # Don't follow redirects
    )

    print(f"Status: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type')}")

    if response.status_code in [301, 302]:
        print(f"Redirected to: {response.headers.get('location')}")

    if "grpc" in response.headers.get("content-type", "").lower():
        print(f"✓ Got gRPC response!")
        print(f"Response headers: {response.headers}")
        print(f"Response body (first 50 bytes): {response.content[:50].hex()}")
    elif "text/html" in response.headers.get("content-type", ""):
        print(f"✗ Got HTML response - Django handled it")
        if len(response.text) < 500:
            print(response.text)
    else:
        print(f"Response body length: {len(response.content)}")
