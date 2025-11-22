"""Direct test of grpcWSGI integration mimicking wsgi.py."""

import io
from unittest.mock import Mock


def test_grpcwsgi_integration_direct():
    """Test grpcWSGI integration directly without Django test client."""

    # 1. Create a simple Django WSGI app
    from django.core.handlers.wsgi import WSGIHandler

    django_app = WSGIHandler()

    # 2. Wrap it with grpcWSGI exactly like in wsgi.py
    from grpcWSGI.server import grpcWSGI

    grpc_app = grpcWSGI(django_app)

    # 3. Register our service
    from sentry.integrations.grpc.generated import scm_pb2_grpc
    from sentry.integrations.grpc.services.scm_service import ScmServicer

    # Create a mock servicer that we can verify gets called
    mock_servicer = Mock(spec=ScmServicer)
    mock_servicer.ListRepositories = Mock(return_value=Mock())

    scm_pb2_grpc.add_ScmServiceServicer_to_server(mock_servicer, grpc_app)

    # 4. Create a WSGI environ for a gRPC-Web request
    environ = {
        "REQUEST_METHOD": "POST",
        "PATH_INFO": "/sentry.integrations.scm.v1.ScmService/ListRepositories",
        "CONTENT_TYPE": "application/grpc-web+proto",
        "CONTENT_LENGTH": "5",
        "wsgi.input": io.BytesIO(b"\x00\x00\x00\x00\x00"),  # Empty gRPC-Web message
        "wsgi.url_scheme": "http",
        "SERVER_NAME": "localhost",
        "SERVER_PORT": "8000",
        "wsgi.errors": io.StringIO(),
        "wsgi.multithread": True,
        "wsgi.multiprocess": True,
        "wsgi.run_once": False,
        "HTTP_HOST": "localhost:8000",
    }

    # 5. Call the grpc_app with this environ
    status_holder = []
    headers_holder = []

    def start_response(status, headers, exc_info=None):
        status_holder.append(status)
        headers_holder.append(headers)
        return lambda data: None

    # 6. Execute the request
    result = grpc_app(environ, start_response)

    # 7. Check results
    print(f"Status: {status_holder}")
    print(f"Headers: {headers_holder}")
    print(f"Result type: {type(result)}")

    # If grpcWSGI handled it, we should NOT get a Django HTML response
    if result:
        body = b"".join(result)
        print(f"Body length: {len(body)}")
        print(f"Body starts with: {body[:100]}")

        # Check if it's HTML (Django) or binary (gRPC)
        is_html = b"<!DOCTYPE" in body or b"<html" in body
        print(f"Is HTML response: {is_html}")

        if is_html:
            print("ERROR: Django is handling the request, not grpcWSGI!")
            return False
        else:
            print("SUCCESS: grpcWSGI handled the request!")
            return True

    return False


if __name__ == "__main__":
    # Setup Django
    import os

    os.environ["DJANGO_SETTINGS_MODULE"] = "sentry.conf.server"

    import django

    django.setup()

    # Run the test
    success = test_grpcwsgi_integration_direct()
    if success:
        print("\n✓ grpcWSGI integration is working!")
    else:
        print("\n✗ grpcWSGI integration is NOT working!")
