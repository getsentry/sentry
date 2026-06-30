import hashlib
import hmac

import jwt as pyjwt
from django.test import override_settings

from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.utils import json


@cell_silo_test
class InternalLlmProxyKeyTest(APITestCase):
    endpoint = "sentry-api-0-internal-llm-proxy-key"
    method = "post"

    def setUp(self):
        super().setUp()
        self.url = "/api/0/internal/llm-proxy/key/"

    def _post(self, data, secret="test-secret"):
        body = json.dumps(data).encode()
        sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return self.client.post(
            self.url,
            data=body,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Rpcsignature rpc0:{sig}",
        )

    @override_settings(SEER_RPC_SHARED_SECRET=["test-secret"])
    def test_generates_valid_jwt(self):
        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": self.organization.id, "feature": "autofix"})

        assert response.status_code == 200
        token = response.data["token"]

        claims = pyjwt.decode(token, "test-secret", algorithms=["HS256"])
        assert claims["org_id"] == self.organization.id
        assert claims["feature"] == "autofix"
        assert claims["iss"] == "sentry"
        assert "project_id" not in claims

    @override_settings(SEER_RPC_SHARED_SECRET=["test-secret"])
    def test_includes_project_id(self):
        project = self.create_project(organization=self.organization)

        with self.feature("organizations:gen-ai-features"):
            response = self._post(
                {
                    "org_id": self.organization.id,
                    "project_id": project.id,
                    "feature": "autofix",
                }
            )

        assert response.status_code == 200
        claims = pyjwt.decode(response.data["token"], "test-secret", algorithms=["HS256"])
        assert claims["project_id"] == project.id

    @override_settings(SEER_RPC_SHARED_SECRET=["test-secret"])
    def test_rejects_inactive_org(self):
        self.organization.update(status=OrganizationStatus.PENDING_DELETION)

        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": self.organization.id, "feature": "autofix"})

        assert response.status_code == 400
        assert response.data["detail"] == "organization_not_found"

    @override_settings(SEER_RPC_SHARED_SECRET=["test-secret"])
    def test_rejects_missing_base_feature(self):
        response = self._post({"org_id": self.organization.id, "feature": "autofix"})

        assert response.status_code == 400
        assert response.data["detail"] == "feature_not_enabled"

    @override_settings(SEER_RPC_SHARED_SECRET=["test-secret"])
    def test_rejects_missing_extra_feature_flag(self):
        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": self.organization.id, "feature": "code_review"})

        assert response.status_code == 400
        assert response.data["detail"] == "feature_not_enabled"

    @override_settings(SEER_RPC_SHARED_SECRET=["test-secret"])
    def test_rejects_unknown_feature(self):
        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": self.organization.id, "feature": "nonexistent"})

        assert response.status_code == 400
        assert response.data["detail"] == "unknown_feature"

    @override_settings(SEER_RPC_SHARED_SECRET=["test-secret"])
    def test_rejects_missing_fields(self):
        response = self._post({"org_id": self.organization.id})

        assert response.status_code == 400

    @override_settings(SEER_RPC_SHARED_SECRET=None)
    def test_rejects_when_no_secret_configured(self):
        with self.feature("organizations:gen-ai-features"):
            response = self._post(
                {"org_id": self.organization.id, "feature": "autofix"},
                secret="test-secret",
            )

        assert response.status_code == 500

    @override_settings(SEER_RPC_SHARED_SECRET=["test-secret"])
    def test_rejects_invalid_signature(self):
        response = self._post(
            {"org_id": self.organization.id, "feature": "autofix"},
            secret="wrong-secret",
        )

        assert response.status_code == 401
