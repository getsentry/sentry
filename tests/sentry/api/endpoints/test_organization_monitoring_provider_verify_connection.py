from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import APITestCase

_PATCH_VERIFY = (
    "sentry.api.endpoints.organization_monitoring_provider_verify_connection.verify_gcp_connection"
)
_PATCH_SA_EMAIL = "sentry.api.endpoints.organization_monitoring_provider_verify_connection.integration_service.get_gcp_service_account_email"

_SA_EMAIL = "sa@sentry-connectors.iam.gserviceaccount.com"


class OrganizationMonitoringProviderVerifyConnectionTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitoring-provider-gcp-verify-connection"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_requires_feature_flag(self) -> None:
        response = self.get_response(
            self.organization.slug,
            customer_sa_email="cust@customer.iam.gserviceaccount.com",
            gcp_project_ids=["proj-a"],
        )
        assert response.status_code == 404

    @patch(_PATCH_SA_EMAIL, return_value=_SA_EMAIL)
    @patch(_PATCH_VERIFY)
    def test_successful_verification(
        self, mock_verify: MagicMock, mock_sa_email: MagicMock
    ) -> None:
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
            "internal_detail": "must not reach the client",
        }

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(
                self.organization.slug,
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=["proj-a"],
            )

        assert response.data["connectionStatus"] == "connected"
        assert len(response.data["projects"]) == 1
        assert response.data["projects"][0]["gcpProjectId"] == "proj-a"
        assert "connection_status" not in response.data
        assert "internalDetail" not in response.data
        mock_sa_email.assert_called_once_with(organization_id=self.organization.id)
        mock_verify.assert_called_once_with(
            sentry_sa_email=_SA_EMAIL,
            customer_sa_email="cust@customer.iam.gserviceaccount.com",
            gcp_project_ids=["proj-a"],
        )

    @patch(_PATCH_SA_EMAIL, return_value=_SA_EMAIL)
    @patch(
        _PATCH_VERIFY,
        return_value={
            "connection_status": "new_status",
            "projects": [
                {
                    "gcp_project_id": "proj-a",
                    "connection_status": "new_status",
                    "services": [
                        {
                            "service": "logging",
                            "status": "new_status",
                            "error_detail": None,
                        }
                    ],
                    "error_detail": None,
                }
            ],
            "error_detail": None,
        },
    )
    def test_forwards_unknown_connection_status(
        self, mock_verify: MagicMock, mock_sa_email: MagicMock
    ) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(
                self.organization.slug,
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=["proj-a"],
            )

        assert response.data["connectionStatus"] == "new_status"
        assert response.data["projects"][0]["connectionStatus"] == "new_status"
        assert response.data["projects"][0]["services"][0]["status"] == "new_status"

    @patch(_PATCH_SA_EMAIL, return_value=_SA_EMAIL)
    @patch(_PATCH_VERIFY, side_effect=IntegrationError("Failed to verify GCP connection."))
    def test_seer_error_returns_502(self, mock_verify: MagicMock, mock_sa_email: MagicMock) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug,
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=["proj-a"],
            )

        assert response.status_code == 502
        assert "Failed to verify GCP connection" in response.data["detail"]

    @patch(_PATCH_SA_EMAIL, return_value=_SA_EMAIL)
    @patch(
        _PATCH_VERIFY,
        return_value={
            "connection_status": "connected",
            "projects": [{"gcp_project_id": "proj-a"}],
        },
    )
    def test_invalid_seer_response_returns_502(
        self, mock_verify: MagicMock, mock_sa_email: MagicMock
    ) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug,
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=["proj-a"],
            )

        assert response.status_code == 502
        assert response.data == {"detail": "Failed to verify GCP connection. Please try again."}

    def test_missing_required_fields(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug)

        assert response.status_code == 400
        assert "customerSaEmail" in response.data
        assert "gcpProjectIds" in response.data

    @patch(_PATCH_SA_EMAIL, return_value=_SA_EMAIL)
    def test_empty_project_ids_rejected(self, mock_sa_email: MagicMock) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug,
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=[],
            )

        assert response.status_code == 400

    @patch(_PATCH_SA_EMAIL, return_value=None)
    def test_no_service_account_returns_404(self, mock_sa_email: MagicMock) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug,
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=["proj-a"],
            )

        assert response.status_code == 404
        assert "No GCP service account" in response.data["detail"]

    @patch(_PATCH_SA_EMAIL, return_value=_SA_EMAIL)
    @patch(_PATCH_VERIFY)
    def test_ignores_sentry_sa_email_from_request_body(
        self, mock_verify: MagicMock, mock_sa_email: MagicMock
    ) -> None:
        mock_verify.return_value = {
            "connection_status": "connected",
            "projects": [],
            "error_detail": None,
        }

        with self.feature("organizations:seer-infra-telemetry"):
            self.get_success_response(
                self.organization.slug,
                sentry_sa_email="evil@attacker.iam.gserviceaccount.com",
                customer_sa_email="cust@customer.iam.gserviceaccount.com",
                gcp_project_ids=["proj-a"],
            )

        mock_verify.assert_called_once_with(
            sentry_sa_email=_SA_EMAIL,
            customer_sa_email="cust@customer.iam.gserviceaccount.com",
            gcp_project_ids=["proj-a"],
        )
