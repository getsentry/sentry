import base64
import hashlib
import hmac
from unittest.mock import patch

from django.urls import reverse

from sentry.overwatch.endpoints.overwatch_rpc import get_config_for_org
from sentry.testutils.cases import APITestCase
from sentry.utils import json


class TestGetConfigForOrg:
    """Test the get_config_for_org function directly."""

    def test_returns_empty_dict_for_any_org(self):
        """Test that the stub implementation returns empty dict for any org name."""
        # Should work with any org name since it's a stub
        assert get_config_for_org(org_name="test-org") == {}
        assert get_config_for_org(org_name="nonexistent-org") == {}
        assert get_config_for_org(org_name="") == {}


class TestOverwatchRpcEndpoint(APITestCase):
    """Test the Overwatch RPC API endpoint."""

    def _create_signed_request(
        self, payload_dict: dict, secret: str = "test-secret", secret_is_b64: bool = False
    ) -> tuple[bytes, str]:
        """Helper to create signed request payload and auth header."""
        payload = json.dumps(payload_dict).encode("utf-8")

        # If the secret is base64 encoded, decode it first for signing
        if secret_is_b64:
            secret_bytes = base64.b64decode(secret)
        else:
            secret_bytes = secret.encode("utf-8")

        signature = hmac.new(secret_bytes, payload, hashlib.sha256).hexdigest()
        auth_header = f"rpcauth rpcAuth:{signature}"
        return payload, auth_header

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        base64.b64encode(b"test-secret").decode(),
    )
    def test_successful_request(self):
        """Test successful request with valid authentication and arguments."""
        b64_secret = base64.b64encode(b"test-secret").decode()
        payload, auth_header = self._create_signed_request(
            {"args": {"org_name": "test-org"}}, b64_secret, True
        )

        url = reverse("sentry-api-0-overwatch-rpc-service", args=["get_config_for_org"])
        response = self.client.post(
            url,
            data=payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=auth_header,
        )

        assert response.status_code == 200
        assert response.data == {}  # Stub implementation returns empty dict

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        base64.b64encode(b"test-secret").decode(),
    )
    def test_invalid_method_returns_404(self):
        """Test that calling an invalid method returns 404."""
        b64_secret = base64.b64encode(b"test-secret").decode()
        payload, auth_header = self._create_signed_request({"args": {}}, b64_secret, True)

        url = reverse("sentry-api-0-overwatch-rpc-service", args=["invalid_method"])
        response = self.client.post(
            url,
            data=payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=auth_header,
        )

        assert response.status_code == 404

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        base64.b64encode(b"test-secret").decode(),
    )
    def test_missing_args_returns_400(self):
        """Test that missing 'args' key returns 400 ParseError."""
        b64_secret = base64.b64encode(b"test-secret").decode()
        payload, auth_header = self._create_signed_request({}, b64_secret, True)

        url = reverse("sentry-api-0-overwatch-rpc-service", args=["get_config_for_org"])
        response = self.client.post(
            url,
            data=payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=auth_header,
        )

        # The endpoint should return 400 since 'args' is required
        assert response.status_code == 400

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        base64.b64encode(b"test-secret").decode(),
    )
    def test_empty_args_returns_400(self):
        """Test that empty 'args' dict returns 400 ParseError."""
        b64_secret = base64.b64encode(b"test-secret").decode()
        payload, auth_header = self._create_signed_request({"args": {}}, b64_secret, True)

        url = reverse("sentry-api-0-overwatch-rpc-service", args=["get_config_for_org"])
        response = self.client.post(
            url,
            data=payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=auth_header,
        )

        # The endpoint should return 400 since org_name is required
        assert response.status_code == 400

    def test_unauthorized_request_returns_403(self):
        """Test that request without proper authentication returns 403."""
        url = reverse("sentry-api-0-overwatch-rpc-service", args=["get_config_for_org"])
        payload = json.dumps({"args": {"org_name": "test-org"}}).encode("utf-8")

        response = self.client.post(
            url,
            data=payload,
            content_type="application/json",
        )

        assert response.status_code == 403

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        base64.b64encode(b"test-secret").decode(),
    )
    def test_invalid_signature_returns_401(self):
        """Test that request with invalid signature returns 401."""
        payload = json.dumps({"args": {"org_name": "test-org"}}).encode("utf-8")
        # Create invalid signature
        auth_header = "rpcauth rpcAuth:invalid_signature"

        url = reverse("sentry-api-0-overwatch-rpc-service", args=["get_config_for_org"])
        response = self.client.post(
            url,
            data=payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=auth_header,
        )

        assert response.status_code == 401
