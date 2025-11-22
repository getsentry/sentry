#!/usr/bin/env python
"""Test wsgi.py directly to verify grpcWSGI integration."""

import io
import os
import sys

# Setup Django environment
os.environ["DJANGO_SETTINGS_MODULE"] = "sentry.conf.server"
sys.path.insert(0, "/Users/mikeihbe/code/sentry/src")

# Import the WSGI application from sentry
from sentry.wsgi import application

print(f"Application type: {type(application)}")
print(f"Application class: {application.__class__.__name__}")

# Check if it's wrapped with grpcWSGI
if hasattr(application, "_handlers"):
    print(f"✓ Application is wrapped with grpcWSGI!")
    print(f"  Number of handlers: {len(application._handlers)}")
else:
    print("✗ Application is NOT wrapped with grpcWSGI")

# Try to make a gRPC request through it
import struct

sys.path.insert(0, "/Users/mikeihbe/code/sentry/src/sentry/integrations/grpc/generated")
import scm_pb2

request = scm_pb2.ListRepositoriesRequest(organization_id=1)
message_bytes = request.SerializeToString()
grpc_web_payload = struct.pack("!BI", 0, len(message_bytes)) + message_bytes

environ = {
    "REQUEST_METHOD": "POST",
    "PATH_INFO": "/sentry.integrations.scm.v1.ScmService/ListRepositories",
    "CONTENT_TYPE": "application/grpc-web+proto",
    "CONTENT_LENGTH": str(len(grpc_web_payload)),
    "wsgi.input": io.BytesIO(grpc_web_payload),
    "wsgi.url_scheme": "http",
    "SERVER_NAME": "localhost",
    "SERVER_PORT": "8000",
    "wsgi.errors": sys.stderr,
    "wsgi.multithread": True,
    "wsgi.multiprocess": True,
    "wsgi.run_once": False,
}

status_holder = []
headers_holder = []


def start_response(status, headers, exc_info=None):
    status_holder.append(status)
    headers_holder.append(headers)
    return lambda data: None


print("\nTesting gRPC request through wsgi.application...")
result = application(environ, start_response)
body = b"".join(result) if result else b""

print(f"Status: {status_holder}")
print(f"Headers: {headers_holder}")

if "grpc" in str(headers_holder).lower():
    print("✓ gRPC response detected!")
elif b"<html" in body or b"<!DOCTYPE" in body:
    print("✗ HTML response - Django handled it")
else:
    print(f"Response body (first 100 bytes): {body[:100]}")
