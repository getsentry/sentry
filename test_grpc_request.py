#!/usr/bin/env python
"""Test gRPC-Web request."""

import os
import sys

sys.path.insert(0, "/Users/mikeihbe/code/sentry/src/sentry/integrations/grpc/generated")
import struct

import requests
import scm_pb2

# Create a proper gRPC-Web request
request = scm_pb2.ListRepositoriesRequest(organization_id=1, page_size=10)  # Use a valid org ID

# Serialize the request
message_bytes = request.SerializeToString()

# gRPC-Web format: 1 byte flags (0x00 = uncompressed), 4 bytes length, then message
flags = b"\x00"
length = struct.pack(">I", len(message_bytes))
grpc_web_payload = flags + length + message_bytes

# Send the request
response = requests.post(
    "http://localhost:8000/sentry.integrations.scm.v1.ScmService/ListRepositories/",
    data=grpc_web_payload,
    headers={
        "Content-Type": "application/grpc-web+proto",
    },
)

print(f"Status: {response.status_code}")
print(f"Content-Type: {response.headers.get('content-type')}")
print(f"Response length: {len(response.content)}")

if response.status_code == 302:
    print(f"Redirected to: {response.headers.get('location')}")
elif "text/html" in response.headers.get("content-type", ""):
    print("Got HTML response - Django is handling the request")
    print(response.text[:500])
else:
    print("Got binary response - might be gRPC")
    print(f"First 20 bytes: {response.content[:20]}")
