from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import APITestCase

_PATCH_VERIFY = (
    "sentry.api.endpoints.organization_monitoring_provider_verify_connection.verify_gcp_connection"
)


class OrganizationMonitoringProviderVerifyConnectionTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitoring-provider-gcp-verify-connection"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_requires_feature_flag(self) -> None:
        response = self.get_response(
            self.organization.slug,
            sentry_sa_email="sa@sentry-connectors.iam.gserviceaccount.com",
            customer_sa_email="cust@customer.iam.gserviceaccount.com",
            gcp_project_ids=["proj-a"],
        )
        assert response.status_code == 404

    @patch(_PATCH_VERIFY)
    def test_successful_verification(self, mock_verify: MagicMock) -> None:
        mock_verify.return_value = {
            "connection_status": "connected",
            "projects": [
                {
                    "gcp_project_id": "proj-a",
                    "connection_status": "connected",
                    "services": [
                        {"service": "logging", "status": "connected", "error_detail": None},
                        {"service": "monitoring", "status": "connected", "error_detail": None},
                        {"service": "cloudtrace", "status": "connected", "error_detail": None},
                    ],
                    "error_detail": None,
                }
            ],
            "error_detail": None,
        }

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(
                self.organization.slug,
                sentry_sa_email="sa@sentry-connectors.iam.gserviceaccount.com",
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=["proj-a"],
            )

        assert response.data["connection_status"] == "connected"
        assert len(response.data["projects"]) == 1
        mock_verify.assert_called_once_with(
            sentry_sa_email="sa@sentry-connectors.iam.gserviceaccount.com",
            customer_sa_email="cust@customer.iam.gserviceaccount.com",
            gcp_project_ids=["proj-a"],
        )

    @patch(_PATCH_VERIFY, side_effect=IntegrationError("Failed to verify GCP connection."))
    def test_seer_error_returns_502(self, mock_verify: MagicMock) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug,
                sentry_sa_email="sa@sentry-connectors.iam.gserviceaccount.com",
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=["proj-a"],
            )

        assert response.status_code == 502
        assert "Failed to verify GCP connection" in response.data["detail"]

    def test_missing_required_fields(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug)

        assert response.status_code == 400
        assert "sentrySaEmail" in response.data
        assert "customerSaEmail" in response.data
        assert "gcpProjectIds" in response.data

    def test_empty_project_ids_rejected(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug,
                sentry_sa_email="sa@sentry-connectors.iam.gserviceaccount.com",
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=[],
            )

        assert response.status_code == 400
