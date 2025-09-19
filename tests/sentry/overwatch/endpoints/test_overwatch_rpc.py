import base64
import hashlib
import hmac
from unittest.mock import patch

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class TestPreventPrReviewResolvedConfigsEndpoint(APITestCase):
    def _auth_header_for_get(self, url: str, params: dict[str, str], b64_secret: str) -> str:
        secret_bytes = base64.b64decode(b64_secret)
        # For GET we sign an empty JSON array body per Rpcsignature rpc0
        message = b"[]"
        signature = hmac.new(secret_bytes, message, hashlib.sha256).hexdigest()
        return f"Rpcsignature rpc0:{signature}"

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_requires_auth(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        # Missing auth
        resp = self.client.get(url, {"ghOrg": "acme", "repo": "acme/repo"})
        assert resp.status_code == 403

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_missing_required_params_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        b64_secret = base64.b64encode(b"test-secret").decode()
        auth = self._auth_header_for_get(url, {}, b64_secret)
        resp = self.client.get(url, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_success_returns_empty_config_dict(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"ghOrg": "acme", "repo": "acme/repo"}
        b64_secret = base64.b64encode(b"test-secret").decode()
        auth = self._auth_header_for_get(url, params, b64_secret)
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {}
        assert "Link" not in resp
