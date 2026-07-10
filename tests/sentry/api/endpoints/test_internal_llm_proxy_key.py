from typing import Any

import jwt as pyjwt
from django.test import override_settings
from rest_framework.response import Response

from sentry.api.endpoints.internal.llm_proxy_key import LlmProxyKeyError
from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context


@cell_silo_test
class InternalLlmProxyKeyTest(APITestCase):
    endpoint = "sentry-api-0-internal-llm-proxy-key"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.url = "/api/0/internal/llm-proxy/key/"

    def _vc_header(self, *, organization_id: int | None, user_id: int | None = None) -> str:
        vc = ViewerContext(
            organization_id=organization_id,
            user_id=user_id,
            actor_type=ActorType.USER,
        )
        return encode_viewer_context(vc)

    def _post(self, data: dict[str, Any], **kwargs: Any) -> Response:
        return self.client.post(
            self.url,
            data=data,
            content_type="application/json",
            HTTP_X_VIEWER_CONTEXT=self._vc_header(
                organization_id=kwargs.get("org_id", self.organization.id)
            ),
        )

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_generates_valid_jwt(self) -> None:
        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": self.organization.id, "feature": "autofix"})

        assert response.status_code == 200
        token = response.data["token"]

        claims = pyjwt.decode(token, "test-secret", algorithms=["HS256"])
        assert claims["organization_id"] == self.organization.id
        assert claims["feature"] == "autofix"
        assert claims["iss"] == "sentry"
        assert "project_id" not in claims

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_includes_project_id(self) -> None:
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

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_inactive_org(self) -> None:
        self.organization.update(status=OrganizationStatus.PENDING_DELETION)

        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": self.organization.id, "feature": "autofix"})

        assert response.status_code == 400
        assert response.data["detail"] == LlmProxyKeyError.ORGANIZATION_NOT_FOUND

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_missing_base_feature(self) -> None:
        response = self._post({"org_id": self.organization.id, "feature": "autofix"})

        assert response.status_code == 400
        assert response.data["detail"] == LlmProxyKeyError.FEATURE_NOT_ENABLED

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_missing_extra_feature_flag(self) -> None:
        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": self.organization.id, "feature": "code_review"})

        assert response.status_code == 400
        assert response.data["detail"] == LlmProxyKeyError.FEATURE_NOT_ENABLED

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_unknown_feature(self) -> None:
        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": self.organization.id, "feature": "nonexistent"})

        assert response.status_code == 400
        assert response.data["detail"] == LlmProxyKeyError.UNKNOWN_FEATURE

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_missing_fields(self) -> None:
        response = self._post({"org_id": self.organization.id})

        assert response.status_code == 400

    @override_settings(SEER_API_SHARED_SECRET="")
    def test_rejects_when_no_secret_configured(self) -> None:
        with self.feature("organizations:gen-ai-features"):
            response = self.client.post(
                self.url,
                data={"org_id": self.organization.id, "feature": "autofix"},
                content_type="application/json",
                HTTP_X_VIEWER_CONTEXT="invalid-no-secret",
            )

        assert response.status_code == 403

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_org_binding_mismatch(self) -> None:
        other_org = self.create_organization()

        with self.feature({"organizations:gen-ai-features": True}):
            response = self.client.post(
                self.url,
                data={"org_id": other_org.id, "feature": "autofix"},
                content_type="application/json",
                HTTP_X_VIEWER_CONTEXT=self._vc_header(organization_id=self.organization.id),
            )

        assert response.status_code == 403

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_non_integer_project_id(self) -> None:
        with self.feature("organizations:gen-ai-features"):
            response = self._post(
                {"org_id": self.organization.id, "project_id": "abc", "feature": "autofix"}
            )

        assert response.status_code == 400
        assert response.data["detail"] == "project_id must be an integer"

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_unauthenticated_request(self) -> None:
        with self.feature("organizations:gen-ai-features"):
            response = self.client.post(
                self.url,
                data={"org_id": self.organization.id, "feature": "autofix"},
                content_type="application/json",
            )

        assert response.status_code == 403

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_non_integer_org_id(self) -> None:
        with self.feature("organizations:gen-ai-features"):
            response = self._post({"org_id": "abc", "feature": "autofix"})

        assert response.status_code == 400
        assert response.data["detail"] == "org_id must be an integer"

    @override_settings(SEER_API_SHARED_SECRET="test-secret")
    def test_rejects_project_from_different_org(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        with self.feature("organizations:gen-ai-features"):
            response = self._post(
                {
                    "org_id": self.organization.id,
                    "project_id": other_project.id,
                    "feature": "autofix",
                }
            )

        assert response.status_code == 400
        assert response.data["detail"] == LlmProxyKeyError.PROJECT_NOT_FOUND
