"""Test the gRPC-Web integration with Django WSGI."""

import io
import struct
import sys
from unittest.mock import MagicMock, patch

from sentry.testutils.cases import TestCase as SentryTestCase
from sentry.testutils.factories import Factories

# Import proto modules
sys.path.insert(0, "/Users/mikeihbe/code/sentry/src/sentry/integrations/grpc/generated")
import scm_pb2


class GrpcWebIntegrationTest(SentryTestCase, Factories):
    """Test the gRPC-Web integration through WSGI."""

    def setUp(self):
        super().setUp()
        # Import wsgi application after Django is set up
        from sentry.wsgi import application

        self.application = application

    def test_grpc_web_handler_is_installed(self):
        """Test that grpcWSGI handler is properly installed."""
        # Check if the application is wrapped with grpcWSGI
        assert hasattr(self.application, "_handlers")
        assert len(self.application._handlers) > 0

    def test_grpc_web_request_without_trailing_slash(self):
        """Test that gRPC-Web requests without trailing slash are handled."""
        # Create a gRPC-Web request
        request = scm_pb2.ListRepositoriesRequest(organization_id=1)
        message_bytes = request.SerializeToString()
        grpc_web_payload = struct.pack("!BI", 0, len(message_bytes)) + message_bytes

        # Create WSGI environ
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

        # Call the application
        result = self.application(environ, start_response)
        body = b"".join(result) if result else b""

        # Check that we got a gRPC response
        assert len(status_holder) == 1
        assert status_holder[0] == "200 OK"

        # Check for gRPC headers (keys may be title-cased)
        headers_dict = {k.lower(): v for k, v in headers_holder[0]}
        assert "content-type" in headers_dict
        assert headers_dict["content-type"] == "application/grpc-web+proto"

    def test_grpc_web_request_with_trailing_slash_redirects(self):
        """Test that gRPC-Web requests with trailing slash get redirected."""
        # Create a gRPC-Web request
        request = scm_pb2.ListRepositoriesRequest(organization_id=1)
        message_bytes = request.SerializeToString()
        grpc_web_payload = struct.pack("!BI", 0, len(message_bytes)) + message_bytes

        # Create WSGI environ with trailing slash
        environ = {
            "REQUEST_METHOD": "POST",
            "PATH_INFO": "/sentry.integrations.scm.v1.ScmService/ListRepositories/",
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

        # Call the application
        result = self.application(environ, start_response)
        body = b"".join(result) if result else b""

        # Check that we got a redirect or HTML response
        assert len(status_holder) == 1
        # Django will either redirect or return HTML, not gRPC
        assert "application/grpc-web" not in str(headers_holder)

    def test_regular_http_request_handled_by_django(self):
        """Test that regular HTTP requests are handled by Django."""
        environ = {
            "REQUEST_METHOD": "GET",
            "PATH_INFO": "/api/0/organizations/",
            "CONTENT_TYPE": "",
            "wsgi.input": io.BytesIO(b""),
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

        # Call the application
        result = self.application(environ, start_response)
        body = b"".join(result) if result else b""

        # Check that we got a response
        assert len(status_holder) == 1
        # Should not be a gRPC response
        headers_dict = dict(headers_holder[0])
        if "content-type" in headers_dict:
            assert "grpc" not in headers_dict["content-type"]


class GrpcServiceAuthenticationTest(SentryTestCase, Factories):
    """Test authentication for gRPC services."""

    def test_auth_disabled_by_default(self):
        """Test that authentication is disabled by default in development."""
        from django.conf import settings

        from sentry.integrations.grpc.services.scm_service import ScmServicer

        # Ensure GRPC_REQUIRE_AUTH is not set or False
        assert not getattr(settings, "GRPC_REQUIRE_AUTH", False)

        servicer = ScmServicer()
        mock_context = MagicMock()

        # Should return True even without auth
        result = servicer._check_auth(mock_context)
        assert result is True

    def test_auth_can_be_enabled(self):
        """Test that authentication can be enabled."""
        import grpc

        from sentry.integrations.grpc.services.scm_service import ScmServicer

        with patch("sentry.integrations.grpc.services.scm_service.settings") as mock_settings:
            # Enable authentication
            mock_settings.GRPC_REQUIRE_AUTH = True

            servicer = ScmServicer()
            mock_context = MagicMock()

            # Mock the context.code() method to return UNAUTHENTICATED
            mock_context.code.return_value = grpc.StatusCode.UNAUTHENTICATED

            # Should fail without proper auth
            with patch(
                "sentry.integrations.grpc.interceptors.auth.check_grpc_authentication"
            ) as mock_check:
                mock_check.return_value = None  # No API key

                result = servicer._check_auth(mock_context)
                assert result is False


class GrpcCsrfExemptionTest(SentryTestCase, Factories):
    """Test that gRPC-Web requests are exempt from CSRF protection."""

    def test_grpc_csrf_exempt(self):
        """Test that gRPC-Web requests are exempt from CSRF protection."""
        org = self.create_organization()

        request = scm_pb2.ListRepositoriesRequest(organization_id=org.id)

        # Make request without CSRF token - should not get 403 Forbidden
        response = self.client.post(
            "/sentry.integrations.scm.v1.ScmService/ListRepositories",  # No trailing slash
            data=request.SerializeToString(),
            content_type="application/grpc-web+proto",
        )

        # Should NOT get CSRF error (403)
        assert response.status_code != 403
        # Should get auth error, success, or redirect (301/302)
        # 301 = permanent redirect (Django's slash handling)
        assert response.status_code in [200, 301, 302, 401, 404]

    def test_grpc_with_different_content_types(self):
        """Test that different gRPC-Web content types are handled."""
        org = self.create_organization()
        request = scm_pb2.ListRepositoriesRequest(organization_id=org.id)

        content_types = [
            "application/grpc-web",
            "application/grpc-web+proto",
            "application/grpc-web+json",
            "application/grpc-web-text",
            "application/grpc-web-text+proto",
        ]

        for content_type in content_types:
            response = self.client.post(
                "/sentry.integrations.scm.v1.ScmService/ListRepositories",  # No trailing slash
                data=request.SerializeToString(),
                content_type=content_type,
            )
            # Should not get CSRF error
            assert response.status_code != 403, f"Got CSRF error for {content_type}"
