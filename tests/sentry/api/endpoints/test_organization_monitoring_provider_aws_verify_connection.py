from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of

_PATCH_VERIFY = (
    "sentry.api.endpoints.organization_monitoring_provider_aws_verify_connection"
    ".verify_aws_connection"
)

_ROLE_ARN = "arn:aws:iam::123456789012:role/SentrySeer"
_OTHER_ROLE_ARN = "arn:aws:iam::123456789012:role/Other"
_EXTERNAL_ID = "11111111-1111-4111-8111-111111111111"

_CONNECTED = {"connection_status": "connected", "error_detail": None}
_DENIED = {
    "connection_status": "error",
    "error_detail": "Could not assume the AWS role. Check the role ARN and trust policy, then try again.",
}


class OrganizationMonitoringProviderAwsVerifyConnectionTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitoring-provider-aws-verify-connection"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.enterContext(self.feature("organizations:integrations-aws"))
        self.organization.update_option("aws-seer.external-id", _EXTERNAL_ID)

    def _install(self, *, role_arn: str = _ROLE_ARN, region: str = "us-east-1") -> Integration:
        return self.create_integration(
            organization=self.organization,
            provider="aws",
            external_id=str(self.organization.id),
            name="AWS for Seer",
            metadata={},
            oi_params={
                "config": {
                    "role_arn": role_arn,
                    "region": region,
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
            response = self.get_response(
                self.organization.slug, role_arn=_ROLE_ARN, region="us-east-1"
            )
        assert response.status_code == 404

    @patch(_PATCH_VERIFY, return_value=_CONNECTED)
    def test_verifies_in_the_cell_with_the_stored_external_id(self, verify: MagicMock) -> None:
        response = self.get_success_response(
            self.organization.slug, role_arn=_ROLE_ARN, region="us-east-1"
        )
        assert response.data == {
            "connectionStatus": "connected",
            "errorDetail": None,
            "roleArn": _ROLE_ARN,
            "region": "us-east-1",
        }
        verify.assert_called_once_with(_ROLE_ARN, _EXTERNAL_ID, "us-east-1")

    @patch(_PATCH_VERIFY, return_value=_CONNECTED)
    def test_ignores_external_id_from_request_body(self, verify: MagicMock) -> None:
        self.get_success_response(
            self.organization.slug,
            role_arn=_ROLE_ARN,
            region="us-east-1",
            external_id="customer-controlled-value",
        )
        verify.assert_called_once_with(_ROLE_ARN, _EXTERNAL_ID, "us-east-1")

    @patch(_PATCH_VERIFY)
    def test_requires_server_generated_external_id(self, verify: MagicMock) -> None:
        self.organization.delete_option("aws-seer.external-id")
        response = self.get_response(self.organization.slug, role_arn=_ROLE_ARN, region="us-east-1")
        assert response.status_code == 404
        assert "external ID" in response.data["detail"]
        verify.assert_not_called()

    @patch(_PATCH_VERIFY)
    def test_rejects_invalid_role_configuration(self, verify: MagicMock) -> None:
        for data, field in [
            ({"role_arn": "not-an-arn", "region": "us-east-1"}, "roleArn"),
            ({"role_arn": _ROLE_ARN, "region": "us-east-1.example.com"}, "region"),
            ({"region": "us-east-1"}, "roleArn"),
            ({"role_arn": _ROLE_ARN}, "region"),
        ]:
            with self.subTest(data=data):
                response = self.get_response(self.organization.slug, **data)
                assert response.status_code == 400
                assert field in response.data
        verify.assert_not_called()

    @patch(_PATCH_VERIFY, side_effect=IntegrationError("Could not verify AWS telemetry access."))
    def test_unavailable_seer_returns_502(self, verify: MagicMock) -> None:
        self._install()
        response = self.get_response(self.organization.slug, role_arn=_ROLE_ARN, region="us-east-1")
        assert response.status_code == 502
        assert "Could not verify" in response.data["detail"]
        assert self._config()["connection_status"] == "unverified"

    @patch(
        _PATCH_VERIFY, side_effect=IntegrationConfigurationError("AWS for Seer is not configured.")
    )
    def test_unconfigured_cell_returns_404(self, verify: MagicMock) -> None:
        response = self.get_response(self.organization.slug, role_arn=_ROLE_ARN, region="us-east-1")
        assert response.status_code == 404
        assert "not configured" in response.data["detail"]

    @patch(_PATCH_VERIFY, return_value=_CONNECTED)
    def test_records_result_on_the_installed_integration(self, verify: MagicMock) -> None:
        self._install()
        self.get_success_response(self.organization.slug, role_arn=_ROLE_ARN, region="us-east-1")
        config = self._config()
        assert config["connection_status"] == "connected"
        assert config["error_detail"] is None
        assert config["last_verified_at"] is not None

    @patch(_PATCH_VERIFY, return_value=_DENIED)
    def test_records_failed_result(self, verify: MagicMock) -> None:
        self._install()
        self.get_success_response(self.organization.slug, role_arn=_ROLE_ARN, region="us-east-1")
        config = self._config()
        assert config["connection_status"] == "error"
        assert config["error_detail"] == _DENIED["error_detail"]

    @patch(_PATCH_VERIFY, return_value=_CONNECTED)
    def test_does_not_record_stale_results(self, verify: MagicMock) -> None:
        """A result for settings other than the stored ones must not update the status."""
        self._install()
        for data in [
            {"role_arn": _OTHER_ROLE_ARN, "region": "us-east-1"},
            {"role_arn": _ROLE_ARN, "region": "eu-west-1"},
        ]:
            with self.subTest(data=data):
                self.get_success_response(self.organization.slug, **data)
                assert self._config()["connection_status"] == "unverified"

    @patch(_PATCH_VERIFY, return_value=_CONNECTED)
    def test_succeeds_without_an_installed_integration(self, verify: MagicMock) -> None:
        """First-time setup verifies before the integration exists; the pipeline records it."""
        response = self.get_success_response(
            self.organization.slug, role_arn=_ROLE_ARN, region="us-east-1"
        )
        assert response.data["connectionStatus"] == "connected"
