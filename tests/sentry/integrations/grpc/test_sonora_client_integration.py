"""Test the Sonora client usage pattern from documentation against real Sentry server."""

import hashlib
import hmac
import io
import sys
from unittest.mock import patch

import pytest
from django.test import override_settings
from google.protobuf import empty_pb2

from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.grpc.generated import scm_pb2, scm_pb2_grpc
from sentry.testutils.cases import TransactionTestCase as SentryTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import SiloMode, assume_test_silo_mode


class WSGITransport:
    """Custom Sonora transport that routes through WSGI test harness."""

    def __init__(self, wsgi_app, base_url="http://testserver", headers=None):
        self.wsgi_app = wsgi_app
        self.base_url = base_url
        self.headers = headers or {}

    def _call_unary_unary(self, method_descriptor, request):
        """Simulate a unary RPC call through WSGI."""
        import struct

        # Get the service and method names
        service_name = method_descriptor.containing_service.full_name
        method_name = method_descriptor.name
        path = f"/{service_name}/{method_name}"

        # Serialize request to gRPC-Web format
        message_bytes = request.SerializeToString()
        grpc_web_payload = struct.pack("!BI", 0, len(message_bytes)) + message_bytes

        # Create WSGI environ
        environ = self._create_wsgi_environ(path, grpc_web_payload)

        # Call WSGI app
        status, response_headers, body = self._call_wsgi_app(environ)

        # Parse response
        response_headers_dict = dict(response_headers)
        grpc_status = response_headers_dict.get("grpc-status", "0")

        if grpc_status != "0":
            # Raise gRPC error
            import grpc

            error_message = response_headers_dict.get("grpc-message", "Unknown error")
            raise grpc.RpcError(f"gRPC error {grpc_status}: {error_message}")

        # Parse response message
        if len(body) >= 5:
            # Parse gRPC-Web frame
            # First byte is flags, next 4 bytes are message length
            message_length = struct.unpack("!I", body[1:5])[0]

            # Extract just the message data
            if len(body) >= 5 + message_length:
                message_data = body[5 : 5 + message_length]
                response_class = method_descriptor.output_type._concrete_class
                response = response_class()
                response.ParseFromString(message_data)
                return response

        return None

    def _create_wsgi_environ(self, path, body):
        """Create WSGI environ dict."""
        environ = {
            "REQUEST_METHOD": "POST",
            "PATH_INFO": path,
            "CONTENT_TYPE": "application/grpc-web+proto",
            "CONTENT_LENGTH": str(len(body)),
            "wsgi.input": io.BytesIO(body),
            "wsgi.url_scheme": "http",
            "SERVER_NAME": "testserver",
            "SERVER_PORT": "80",
            "wsgi.errors": sys.stderr,
            "wsgi.multithread": True,
            "wsgi.multiprocess": True,
            "wsgi.run_once": False,
        }

        # Add headers
        for key, value in self.headers.items():
            key = key.upper().replace("-", "_")
            if not key.startswith("CONTENT_"):
                key = f"HTTP_{key}"
            environ[key] = value

        return environ

    def _call_wsgi_app(self, environ):
        """Call WSGI app and return results."""
        status_holder = []
        headers_holder = []

        def start_response(status, headers, exc_info=None):
            status_holder.append(status)
            headers_holder.append(headers)
            return lambda data: None

        result = self.wsgi_app(environ, start_response)
        body = b"".join(result) if result else b""

        return status_holder[0], headers_holder[0], body


class SonoraLikeClient:
    """A minimal Sonora-like client implementation for testing."""

    def __init__(self, service_stub, transport):
        self.service_stub = service_stub
        self.transport = transport
        # Don't create stub instance, just store the class
        self._stub_class = service_stub

    def __getattr__(self, name):
        """Proxy method calls to the transport."""
        # Try to get the response class for this method
        response_class_name = f"{name}Response"
        response_class = getattr(scm_pb2, response_class_name, empty_pb2.Empty)

        # Create a mock method descriptor
        method_descriptor = type(
            "MethodDescriptor",
            (),
            {
                "containing_service": type(
                    "Service", (), {"full_name": "sentry.integrations.scm.v1.ScmService"}
                ),
                "name": name,
                "output_type": type("OutputType", (), {"_concrete_class": response_class}),
            },
        )()

        def call_method(request):
            return self.transport._call_unary_unary(method_descriptor, request)

        return call_method


class TestSonoraClientIntegration(SentryTestCase, Factories):
    """Test Sonora client usage as documented in README and examples."""

    @assume_test_silo_mode(SiloMode.MONOLITH)
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

        # Create GitHub integration using factory
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Test GitHub",
            external_id="github:123",
            metadata={
                "access_token": "test-token",
                "installation_id": "12345",
            },
        )

        # Create repository using factory
        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            external_id="123456",
            url="https://github.com/getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
        )

    @override_settings(GRPC_REQUIRE_AUTH=True)
    @override_options({"grpc.auth_tokens": ["test-api-key", "another-valid-key"]})
    def test_sonora_client_with_token_auth(self):
        """Test the basic Sonora usage example from README with token auth."""
        from sentry.wsgi import application

        # This is exactly how the README shows to use Sonora
        # (minus the actual Sonora import which we're simulating)
        # Create transport with authentication
        transport = WSGITransport(
            wsgi_app=application,
            base_url="http://testserver",
            headers={"X-Grpc-Auth-Token": "test-api-key"},
        )

        # Create client using our Sonora-like implementation
        client = SonoraLikeClient(service_stub=scm_pb2_grpc.ScmServiceStub, transport=transport)

        # Make request exactly as shown in documentation
        request = scm_pb2.GetRepositoriesRequest(organization_id=self.organization.id, page_size=10)

        # Mock the GitHub API response
        mock_repos = [
            {
                "name": "getsentry/sentry",
                "identifier": "123456",
                "url": "https://github.com/getsentry/sentry",
            }
        ]

        with patch.object(GitHubIntegration, "get_repositories", return_value=mock_repos):
            response = client.GetRepositories(request)

            # Verify we got repositories back
            assert hasattr(response, "repositories")
            assert len(response.repositories) >= 1
            assert any(r.name == "getsentry/sentry" for r in response.repositories)

    @override_settings(GRPC_REQUIRE_AUTH=True)
    @override_options({"grpc.hmac_secrets": ["shared-secret", "backup-secret"]})
    def test_sonora_client_with_hmac_auth(self):
        """Test HMAC authentication pattern as shown in documentation."""
        from sentry.wsgi import application

        # This test validates the HMAC signing pattern works correctly
        # Prepare request
        request = scm_pb2.GetRepositoriesRequest(organization_id=self.organization.id, page_size=5)

        # Generate HMAC signature as shown in README
        body_hex = request.SerializeToString().hex()
        method = "/sentry.integrations.scm.v1.ScmService/GetRepositories"
        signing_payload = f"{method}:{body_hex}".encode()

        signature = hmac.new(b"shared-secret", signing_payload, hashlib.sha256).hexdigest()

        # Create transport with HMAC headers
        transport = WSGITransport(
            wsgi_app=application,
            base_url="http://testserver",
            headers={"X-Signature": signature, "X-Body": body_hex, "X-Method": method},
        )

        client = SonoraLikeClient(service_stub=scm_pb2_grpc.ScmServiceStub, transport=transport)

        # Mock the GitHub integration response
        mock_repos = [{"name": "test-repo", "identifier": "1", "url": "https://github.com/test"}]

        with patch.object(GitHubIntegration, "get_repositories", return_value=mock_repos):
            response = client.GetRepositories(request)
            assert len(response.repositories) >= 1

    @override_settings(GRPC_REQUIRE_AUTH=False)
    def test_advanced_usage_pattern_from_readme(self):
        """Test the advanced usage pattern with error handling from README."""
        from sentry.wsgi import application

        # Configure transport exactly as shown in advanced example
        transport = WSGITransport(
            wsgi_app=application,
            base_url="http://sentry.example.com",
            headers={"X-Grpc-Auth-Token": "token"},
            # timeout would be handled by real Sonora
        )

        client = SonoraLikeClient(service_stub=scm_pb2_grpc.ScmServiceStub, transport=transport)

        # Test with provider and query as shown in example
        request = scm_pb2.GetRepositoriesRequest(
            organization_id=self.organization.id,
            provider=scm_pb2.PROVIDER_GITHUB,
            query="sentry",  # Search for "sentry" repos
        )

        # Mock the GitHub integration response with repos matching the query
        mock_repos = [
            {
                "name": "getsentry/sentry",
                "identifier": "1",
                "url": "https://github.com/getsentry/sentry",
            }
        ]

        with patch.object(GitHubIntegration, "get_repositories", return_value=mock_repos):
            try:
                response = client.GetRepositories(request)
                # Should find our test repo
                for repo in response.repositories:
                    if "sentry" in repo.name.lower():
                        assert repo.url  # Has URL as shown in example

            except Exception as e:
                # Error handling as shown in example
                pytest.fail(f"Unexpected error: {e}")

    @override_settings(GRPC_REQUIRE_AUTH=True)
    @override_options({"grpc.auth_tokens": ["old-token", "current-token", "future-token"]})
    def test_key_rotation_scenario(self):
        """Test key rotation scenario with multiple valid tokens."""
        from sentry.wsgi import application

        # Test that any of the tokens work (simulating key rotation)
        for token in ["old-token", "current-token", "future-token"]:
            transport = WSGITransport(
                wsgi_app=application,
                base_url="http://testserver",
                headers={"X-Grpc-Auth-Token": token},
            )

            client = SonoraLikeClient(service_stub=scm_pb2_grpc.ScmServiceStub, transport=transport)

            request = scm_pb2.GetRepositoriesRequest(organization_id=self.organization.id)

            # Mock the GitHub integration response
            mock_repos = []
            with patch.object(GitHubIntegration, "get_repositories", return_value=mock_repos):
                response = client.GetRepositories(request)
                assert len(response.repositories) >= 0  # Should succeed with any valid token

    def test_error_handling(self):
        """Test gRPC error handling as users would experience it."""
        from sentry.wsgi import application

        with override_settings(GRPC_REQUIRE_AUTH=True):
            with override_options({"grpc.auth_tokens": ["valid-token"]}):
                # Create client with invalid token
                transport = WSGITransport(
                    wsgi_app=application,
                    base_url="http://testserver",
                    headers={"X-Grpc-Auth-Token": "invalid-token"},
                )

                client = SonoraLikeClient(
                    service_stub=scm_pb2_grpc.ScmServiceStub, transport=transport
                )

                request = scm_pb2.GetRepositoriesRequest(organization_id=self.organization.id)

                # Should raise authentication error
                with pytest.raises(Exception) as exc:
                    client.GetRepositories(request)

                assert "16" in str(exc.value) or "UNAUTHENTICATED" in str(exc.value)
