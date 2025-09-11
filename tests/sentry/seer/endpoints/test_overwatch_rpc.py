import hashlib
import hmac
from unittest.mock import patch

from django.urls import reverse

from sentry.seer.endpoints.overwatch_rpc import get_config_for_org
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
        self, payload_dict: dict, secret: str = "test-secret"
    ) -> tuple[bytes, str]:
        """Helper to create signed request payload and auth header."""
        payload = json.dumps(payload_dict).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        auth_header = f"rpcauth rpcAuth:{signature}"
        return payload, auth_header

    @patch(
        "sentry.seer.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET", ["test-secret"]
    )
    def test_successful_request(self):
        """Test successful request with valid authentication and arguments."""
        payload, auth_header = self._create_signed_request({"args": {"org_name": "test-org"}})

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
        "sentry.seer.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET", ["test-secret"]
    )
    def test_invalid_method_returns_404(self):
        """Test that calling an invalid method returns 404."""
        payload, auth_header = self._create_signed_request({"args": {}})

        url = reverse("sentry-api-0-overwatch-rpc-service", args=["invalid_method"])
        response = self.client.post(
            url,
            data=payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=auth_header,
        )

        assert response.status_code == 404

    @patch(
        "sentry.seer.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET", ["test-secret"]
    )
    def test_missing_args_returns_success(self):
        """Test that missing 'args' key defaults to empty dict and still works."""
        payload, auth_header = self._create_signed_request({})

        url = reverse("sentry-api-0-overwatch-rpc-service", args=["get_config_for_org"])
        response = self.client.post(
            url,
            data=payload,
            content_type="application/json",
            HTTP_AUTHORIZATION=auth_header,
        )

        # The endpoint should still work since get_config_for_org doesn't require valid args
        assert response.status_code == 200

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
        "sentry.seer.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET", ["test-secret"]
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
