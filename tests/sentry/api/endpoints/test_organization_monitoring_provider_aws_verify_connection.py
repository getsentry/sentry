from __future__ import annotations

from typing import Any
from unittest.mock import patch

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of

_PATCH_VERIFY = (
    "sentry.api.endpoints.organization_monitoring_provider_aws_verify_connection"
    ".verify_aws_connection"
)

_ROLE_ARN = "arn:aws:iam::123456789012:role/sentry-seer/SentrySeer"
_OTHER_ROLE_ARN = "arn:aws:iam::123456789012:role/sentry-seer/Other"
_EXTERNAL_ID = "11111111-1111-4111-8111-111111111111"

_CONNECTED = {"connection_status": "connected", "error_detail": None}
_DENIED = {
    "connection_status": "error",
    "error_detail": "Could not assume the AWS role. Check the role ARN and trust policy, then try again.",
}


class OrganizationMonitoringProviderAwsVerifyConnectionTest(APITestCase):
    method = "post"

    @property
    def endpoint(self) -> str:
        return "sentry-api-0-organization-monitoring-provider-aws-verify-connection"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.enterContext(self.feature("organizations:integrations-aws"))
        self.organization.update_option("aws-seer.external-id", _EXTERNAL_ID)
        self.verify = self.enterContext(patch(_PATCH_VERIFY, return_value=_CONNECTED))

    def _verify_role(self, *, status_code: int = 200, **overrides: str) -> dict[str, Any]:
        data = {"role_arn": _ROLE_ARN, "region": "us-east-1", **overrides}
        response = self.get_response(self.organization.slug, **data)
        assert response.status_code == status_code, response.content
        return response.data

    def _install(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="aws",
            external_id=str(self.organization.id),
            oi_params={
                "config": {
                    "role_arn": _ROLE_ARN,
                    "region": "us-east-1",
                    "external_id": _EXTERNAL_ID,
                    "connection_status": "unverified",
                    "error_detail": None,
                    "last_verified_at": None,
                }
            },
        )

    def _config(self) -> dict[str, Any]:
        with assume_test_silo_mode_of(OrganizationIntegration):
            oi = OrganizationIntegration.objects.get(organization_id=self.organization.id)
        assert isinstance(oi.config, dict)
        return oi.config

    def test_requires_feature_flag(self) -> None:
        with self.feature({"organizations:integrations-aws": False}):
            self._verify_role(status_code=404)
        self.verify.assert_not_called()

    def test_requires_integration_management_scope(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
            read_token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
            manage_token = self.create_user_auth_token(
                user=self.user, scope_list=["org:integrations"]
            )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {read_token.token}")
        self._verify_role(status_code=403)
        self.verify.assert_not_called()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {manage_token.token}")
        self._verify_role()

    def test_verifies_in_the_cell_with_the_stored_external_id(self) -> None:
        result = self._verify_role()
        assert result.pop("verificationReceipt")
        assert result == {
            "connectionStatus": "connected",
            "errorDetail": None,
            "roleArn": _ROLE_ARN,
            "region": "us-east-1",
        }
        self.verify.assert_called_once_with(_ROLE_ARN, _EXTERNAL_ID, "us-east-1")

    def test_ignores_external_id_from_request_body(self) -> None:
        self._verify_role(external_id="customer-controlled-value")
        self.verify.assert_called_once_with(_ROLE_ARN, _EXTERNAL_ID, "us-east-1")

    def test_requires_server_generated_external_id(self) -> None:
        self.organization.delete_option("aws-seer.external-id")
        assert "external ID" in self._verify_role(status_code=404)["detail"]
        self.verify.assert_not_called()

    def test_rejects_invalid_role_configuration(self) -> None:
        for data, field in [
            ({"role_arn": "not-an-arn", "region": "us-east-1"}, "roleArn"),
            ({"role_arn": _ROLE_ARN, "region": "us-east-1.example.com"}, "region"),
            ({"region": "us-east-1"}, "roleArn"),
            ({"role_arn": _ROLE_ARN}, "region"),
        ]:
            with self.subTest(data=data):
                response = self.get_error_response(self.organization.slug, status_code=400, **data)
                assert field in response.data
        self.verify.assert_not_called()

    def test_unavailable_seer_returns_502(self) -> None:
        self._install()
        self.verify.side_effect = IntegrationError("unavailable")
        assert "Could not verify" in self._verify_role(status_code=502)["detail"]
        assert self._config()["connection_status"] == "unverified"

    def test_unconfigured_cell_returns_404(self) -> None:
        self.verify.side_effect = IntegrationConfigurationError("missing workload identity")
        assert "not configured" in self._verify_role(status_code=404)["detail"]

    def test_records_result_on_the_installed_integration(self) -> None:
        self._install()
        self._verify_role()
        config = self._config()
        assert config["connection_status"] == "connected"
        assert config["error_detail"] is None
        assert config["last_verified_at"] is not None

    def test_records_failed_result(self) -> None:
        self._install()
        self.verify.return_value = _DENIED
        self._verify_role()
        config = self._config()
        assert config["connection_status"] == "error"
        assert config["error_detail"] == _DENIED["error_detail"]
        assert config["last_verified_at"] is not None

    def test_does_not_record_stale_results(self) -> None:
        """A result for settings other than the stored ones must not update the status."""
        self._install()
        for role_arn, region in [(_OTHER_ROLE_ARN, "us-east-1"), (_ROLE_ARN, "eu-west-1")]:
            with self.subTest(role_arn=role_arn, region=region):
                self._verify_role(role_arn=role_arn, region=region)
                assert self._config()["connection_status"] == "unverified"

    def test_concurrent_settings_save_is_not_overwritten(self) -> None:
        self._install()
        snapshot = integration_service.organization_context(
            organization_id=self.organization.id, provider="aws"
        )
        assert snapshot.organization_integration is not None
        integration_service.update_organization_integration(
            org_integration_id=snapshot.organization_integration.id,
            config={**self._config(), "role_arn": _OTHER_ROLE_ARN},
        )
        # The cell saw the old settings, but control must compare against the live row.
        with patch.object(integration_service, "organization_context", return_value=snapshot):
            self._verify_role()
        config = self._config()
        assert config["role_arn"] == _OTHER_ROLE_ARN
        assert config["connection_status"] == "unverified"

    def test_succeeds_without_an_installed_integration(self) -> None:
        """First-time setup verifies before the integration exists; the pipeline records it."""
        assert self._verify_role()["connectionStatus"] == "connected"
