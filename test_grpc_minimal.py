#!/usr/bin/env python
"""Minimal test of grpcWSGI routing."""

import io
import sys
sys.path.insert(0, '/Users/mikeihbe/code/sentry/src')

# Test grpcWSGI without Django complications
from grpcWSGI.server import grpcWSGI

# Create a simple fallback app
def fallback_app(environ, start_response):
    start_response('200 OK', [('Content-Type', 'text/plain')])
    return [b'Fallback app handled this request']

# Wrap with grpcWSGI
grpc_app = grpcWSGI(fallback_app)

# Add the generated directory to path
sys.path.insert(0, '/Users/mikeihbe/code/sentry/src/sentry/integrations/grpc/generated')
import scm_pb2_grpc

# Create a simple test servicer with all required methods
class TestServicer:
    def ListRepositories(self, request, context):
        print("✓ ListRepositories was successfully called via grpcWSGI!")
        print(f"  Request organization_id: {request.organization_id}")
        # Return a proper response
        response = scm_pb2.ListRepositoriesResponse()
        return response

    def GetRepository(self, request, context):
        return None

    def GetCommit(self, request, context):
        return None

    def GetCommitContext(self, request, context):
        return None

    def CreateCodeMapping(self, request, context):
        return None

    def DeriveCodeMappings(self, request, context):
        return None

    def CreateExternalIssue(self, request, context):
        return None

    def LinkExternalIssue(self, request, context):
        return None

# Register the service
servicer = TestServicer()
scm_pb2_grpc.add_ScmServiceServicer_to_server(servicer, grpc_app)

# Check if handlers are registered
print(f"Number of handlers registered: {len(grpc_app._handlers)}")

# Create a proper gRPC-Web message
# Format: 1 byte flags (0x00 = uncompressed), 4 bytes length (big-endian), then message
import struct
import scm_pb2

request_msg = scm_pb2.ListRepositoriesRequest(organization_id=1)
serialized = request_msg.SerializeToString()
grpc_web_message = struct.pack('!BI', 0, len(serialized)) + serialized

# Create test environ
environ = {
    'REQUEST_METHOD': 'POST',
    'PATH_INFO': '/sentry.integrations.scm.v1.ScmService/ListRepositories',
    'CONTENT_TYPE': 'application/grpc-web+proto',
    'CONTENT_LENGTH': str(len(grpc_web_message)),
    'wsgi.input': io.BytesIO(grpc_web_message),
    'wsgi.url_scheme': 'http',
    'SERVER_NAME': 'localhost',
    'SERVER_PORT': '8000',
}

# Check if grpcWSGI recognizes the path
handler = grpc_app._get_rpc_handler(environ)
print(f"Handler found for path: {handler}")

# Now test the full request
status_holder = []
headers_holder = []

def start_response(status, headers, exc_info=None):
    status_holder.append(status)
    headers_holder.append(headers)
    return lambda data: None

# Execute the request
print("\nExecuting request...")
result = grpc_app(environ, start_response)
body = b''.join(result)

print(f"Status: {status_holder}")
print(f"Headers: {headers_holder}")
print(f"Body: {body}")

# Check what handled it
if b'Fallback app' in body:
    print("\n✗ PROBLEM: Fallback app handled the request - grpcWSGI did NOT intercept!")
else:
    print("\n✓ SUCCESS: grpcWSGI intercepted the request!")
