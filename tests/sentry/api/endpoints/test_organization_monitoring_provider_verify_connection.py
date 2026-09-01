from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of

_PATCH_VERIFY = (
    "sentry.api.endpoints.organization_monitoring_provider_verify_connection.verify_gcp_connection"
)
_PATCH_SA_EMAIL = "sentry.api.endpoints.organization_monitoring_provider_verify_connection.integration_service.get_gcp_service_account_email"

_SENTRY_SA = "sa@sentry-connectors.iam.gserviceaccount.com"
_CUSTOMER_SA = "cust@customer.iam.gserviceaccount.com"


def _denied_result(project_id: str = "proj-a") -> dict[str, Any]:
    return {
        "connection_status": "permission_denied",
        "projects": [
            {
                "gcp_project_id": project_id,
                "connection_status": "permission_denied",
                "services": [
                    {"service": "logging", "status": "connected", "error_detail": None},
                    {
                        "service": "cloudtrace",
                        "status": "permission_denied",
                        "error_detail": "IAM roles not granted",
                    },
                ],
                "error_detail": None,
            }
        ],
        "error_detail": None,
    }


class OrganizationMonitoringProviderVerifyConnectionTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitoring-provider-gcp-verify-connection"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _install(
        self, *, projects: list[str] | None = None, customer_sa: str = _CUSTOMER_SA
    ) -> Integration:
        project_ids = projects or ["proj-a"]
        return self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
            oi_params={
                "config": {
                    "sentry_sa_email": _SENTRY_SA,
                    "customer_sa_email": customer_sa,
                    "projects": project_ids,
                    "connection_status": "unverified",
                    "project_statuses": [
                        {
                            "gcp_project_id": project_id,
                            "connection_status": "unverified",
                            "error_detail": None,
                        }
                        for project_id in project_ids
                    ],
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
        response = self.get_response(
            self.organization.slug,
            customer_sa_email="cust@customer.iam.gserviceaccount.com",
            gcp_project_ids=["proj-a"],
        )
        assert response.status_code == 404

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
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
            sentry_sa_email=_SENTRY_SA,
            customer_sa_email="cust@customer.iam.gserviceaccount.com",
            gcp_project_ids=["proj-a"],
        )

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
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

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
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

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
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

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
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

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
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
            sentry_sa_email=_SENTRY_SA,
            customer_sa_email="cust@customer.iam.gserviceaccount.com",
            gcp_project_ids=["proj-a"],
        )

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
    @patch(_PATCH_VERIFY, return_value=_denied_result())
    def test_records_result_on_the_installed_integration(
        self, mock_verify: MagicMock, mock_sa_email: MagicMock
    ) -> None:
        self._install()

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(
                self.organization.slug,
                customer_sa_email=_CUSTOMER_SA,
                gcp_project_ids=["proj-a"],
            )

        assert response.data["projects"][0]["errorDetail"] == ("Cloud Trace: IAM roles not granted")

        config = self._config()
        assert config["connection_status"] == "permission_denied"
        assert config["project_statuses"] == [
            {
                "gcp_project_id": "proj-a",
                "connection_status": "permission_denied",
                "error_detail": "Cloud Trace: IAM roles not granted",
            }
        ]
        assert config["last_verified_at"] is not None
        assert config["customer_sa_email"] == _CUSTOMER_SA
        assert config["sentry_sa_email"] == _SENTRY_SA

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
    @patch(
        _PATCH_VERIFY,
        return_value={
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
        },
    )
    def test_records_a_connected_result(
        self, mock_verify: MagicMock, mock_sa_email: MagicMock
    ) -> None:
        self._install()

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(
                self.organization.slug,
                customer_sa_email=_CUSTOMER_SA,
                gcp_project_ids=["proj-a"],
            )

        assert response.data["connectionStatus"] == "connected"
        assert response.data["projects"][0]["errorDetail"] is None

        config = self._config()
        assert config["connection_status"] == "connected"
        assert config["project_statuses"] == [
            {
                "gcp_project_id": "proj-a",
                "connection_status": "connected",
                "error_detail": None,
            }
        ]
        assert config["last_verified_at"] is not None

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
    @patch(_PATCH_VERIFY, return_value=_denied_result())
    def test_skips_recording_when_the_sa_email_is_stale(
        self, mock_verify: MagicMock, mock_sa_email: MagicMock
    ) -> None:
        self._install(customer_sa="current@customer.iam.gserviceaccount.com")

        with self.feature("organizations:seer-infra-telemetry"):
            self.get_success_response(
                self.organization.slug,
                customer_sa_email=_CUSTOMER_SA,
                gcp_project_ids=["proj-a"],
            )

        assert self._config()["connection_status"] == "unverified"

    @patch(_PATCH_SA_EMAIL, return_value=_SENTRY_SA)
    @patch(_PATCH_VERIFY, return_value=_denied_result())
    def test_skips_recording_when_the_project_set_is_stale(
        self, mock_verify: MagicMock, mock_sa_email: MagicMock
    ) -> None:
        self._install(projects=["proj-a", "proj-b"])

        with self.feature("organizations:seer-infra-telemetry"):
            self.get_success_response(
                self.organization.slug,
                customer_sa_email=_CUSTOMER_SA,
                gcp_project_ids=["proj-a"],
            )

        assert self._config()["connection_status"] == "unverified"
