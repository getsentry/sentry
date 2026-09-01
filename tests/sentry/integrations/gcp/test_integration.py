from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any, cast
from unittest.mock import Mock, patch

import pytest

from sentry.integrations.gcp.client import _CONNECTORS_PROJECT, _GCP_IAM_BASE
from sentry.integrations.gcp.integration import (
    GcpCustomerConfigApiStep,
    GcpIntegration,
    GcpIntegrationProvider,
    GcpSaGenerationApiStep,
    GcpVerification,
    GcpVerificationApiStep,
    GcpVerificationInputSerializer,
)
from sentry.integrations.gcp.utils import (
    GCP_STATUS_UNVERIFIED,
    parse_customer_sa_email,
    parse_gcp_project_ids,
    resolve_project_error_detail,
    validate_gcp_project_id,
)
from sentry.integrations.models.gcp_service_account import GcpServiceAccount
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.pipeline.types import PipelineStepAction, PipelineStepResult
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

_SA_EMAIL = "sentry-abc123@sentry-connectors.iam.gserviceaccount.com"
_CUSTOMER_SA = "gcp-sentry@customer-project.iam.gserviceaccount.com"


def _mock_iam_session() -> AbstractContextManager[Mock]:
    return patch(
        "sentry.integrations.gcp.client._get_iam_session",
        return_value=Mock(spec=["post", "delete"]),
    )


def _setup_create_sa_response(mock_session: Mock, sa_email: str) -> None:
    create_resp = Mock(ok=True)
    create_resp.json.return_value = {"email": sa_email}
    mock_session.post.return_value = create_resp


@control_silo_test
class GcpIntegrationTest(TestCase):
    """Tests the full GCP integration lifecycle: setup wizard -> build -> install -> uninstall."""

    def setUp(self) -> None:
        super().setUp()
        self.provider = GcpIntegrationProvider()
        self.provider.pipeline = Mock(organization=Mock(id=self.organization.id))

    def _make_pipeline(self, *, state: dict[str, object] | None = None) -> Mock:
        pipeline = Mock(organization=Mock(id=self.organization.id))
        stored: dict[str, object] = state or {}
        pipeline.fetch_state.side_effect = lambda key: stored.get(key)
        pipeline.bind_state.side_effect = lambda key, val: stored.__setitem__(key, val)
        return pipeline

    def _state(self, **overrides: object) -> dict[str, object]:
        config: dict[str, object] = {
            "customer_sa_email": _CUSTOMER_SA,
            "projects": ["my-gcp-project"],
        }
        config.update(overrides)
        return {
            "config": config,
            "sentry_sa_email": _SA_EMAIL,
        }

    def _create_installed_integration(
        self,
        *,
        sa_email: str = _SA_EMAIL,
        projects: list[str] | None = None,
        connection_status: str = "connected",
    ) -> GcpIntegration:
        project_ids = projects or ["my-gcp-project"]
        gcp_config = {
            "sentry_sa_email": sa_email,
            "customer_sa_email": _CUSTOMER_SA,
            "projects": project_ids,
            "connection_status": connection_status,
            "project_statuses": [
                {
                    "gcp_project_id": project_id,
                    "connection_status": connection_status,
                    "error_detail": None,
                }
                for project_id in project_ids
            ],
            "last_verified_at": "2026-08-01T00:00:00+00:00",
        }
        integration = self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
            oi_params={"config": gcp_config},
        )
        installation = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, GcpIntegration)
        return installation

    # -- Setup wizard: SA generation step --

    @patch("sentry.integrations.gcp.client.secrets.token_hex", return_value="abcdef123456")
    def test_setup_step_creates_sa_and_persists_to_model(self, _mock_token_hex: Mock) -> None:
        expected_email = f"sentry-abcdef123456@{_CONNECTORS_PROJECT}.iam.gserviceaccount.com"
        step = GcpSaGenerationApiStep()
        pipeline = self._make_pipeline()

        with _mock_iam_session() as mock_get_session:
            mock_session = mock_get_session.return_value
            _setup_create_sa_response(mock_session, expected_email)

            step_data = step.get_step_data(pipeline, Mock())

        assert step_data["sentrySaEmail"] == expected_email
        pipeline.fetch_state.assert_called_with("sentry_sa_email")

        mock_session.post.assert_called_once()
        create_call = mock_session.post.call_args
        assert create_call.args[0] == (
            f"{_GCP_IAM_BASE}/projects/{_CONNECTORS_PROJECT}/serviceAccounts"
        )
        assert create_call.kwargs["json"]["accountId"] == "sentry-abcdef123456"
        assert create_call.kwargs["json"]["serviceAccount"]["displayName"] == (
            f"Sentry org {self.organization.id}"
        )

        sa_record = GcpServiceAccount.objects.get(organization_id=self.organization.id)
        assert sa_record.service_account_email == expected_email

    def test_setup_step_reuses_sa_on_page_refresh(self) -> None:
        step = GcpSaGenerationApiStep()
        pipeline = self._make_pipeline(state={"sentry_sa_email": _SA_EMAIL})

        with patch("sentry.integrations.gcp.integration.generate_sentry_sa") as mock_gen:
            step_data = step.get_step_data(pipeline, Mock())

        assert step_data["sentrySaEmail"] == _SA_EMAIL
        mock_gen.assert_not_called()

    def test_setup_step_reuses_sa_from_model_across_sessions(self) -> None:
        self.create_gcp_service_account(
            organization=self.organization,
            service_account_email=_SA_EMAIL,
        )
        step = GcpSaGenerationApiStep()
        pipeline = self._make_pipeline()

        with _mock_iam_session() as mock_get_session:
            step_data = step.get_step_data(pipeline, Mock())

        assert step_data["sentrySaEmail"] == _SA_EMAIL
        mock_get_session.return_value.post.assert_not_called()

    def test_setup_step_advances_on_post(self) -> None:
        step = GcpSaGenerationApiStep()
        result = step.handle_post(None, Mock(), Mock())
        assert result == PipelineStepResult.advance()

    def test_setup_step_raises_on_gcp_api_failure(self) -> None:
        step = GcpSaGenerationApiStep()
        pipeline = self._make_pipeline()

        with _mock_iam_session() as mock_get_session:
            mock_session = mock_get_session.return_value
            mock_session.post.return_value = Mock(ok=False, status_code=403)

            with pytest.raises(IntegrationError, match="Failed to create"):
                step.get_step_data(pipeline, Mock())

        assert not GcpServiceAccount.objects.filter(organization_id=self.organization.id).exists()

    # -- Setup wizard: step contract --

    def test_pipeline_steps_match_frontend_step_ids(self) -> None:
        steps = [
            step() if callable(step) else step for step in self.provider.get_pipeline_api_steps()
        ]
        assert [step.step_name for step in steps] == [
            "gcp_sa_generation",
            "gcp_customer_config",
            "gcp_verification",
        ]

    def test_config_step_drops_duplicate_projects(self) -> None:
        step = GcpCustomerConfigApiStep()
        state: dict[str, object] = {"sentry_sa_email": _SA_EMAIL}
        pipeline = self._make_pipeline(state=state)

        result = step.handle_post(
            {
                "customer_sa_email": _CUSTOMER_SA,
                "projects": ["project-prod", "project-staging", "project-prod"],
            },
            pipeline,
            Mock(),
        )

        assert result == PipelineStepResult.advance()
        config = state["config"]
        assert isinstance(config, dict)
        assert config["projects"] == ["project-prod", "project-staging"]

    # -- Setup wizard: verification step --

    def _validated_verification(self, **overrides: object) -> GcpVerification:
        data: dict[str, Any] = {
            "connectionStatus": "connected",
            "projects": [{"gcpProjectId": "my-gcp-project", "connectionStatus": "connected"}],
        }
        data.update(overrides)
        serializer = GcpVerificationInputSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        return cast(GcpVerification, serializer.validated_data)

    def test_verification_step_exposes_values_to_verify(self) -> None:
        step = GcpVerificationApiStep()
        pipeline = self._make_pipeline(
            state={
                "sentry_sa_email": _SA_EMAIL,
                "config": {
                    "customer_sa_email": _CUSTOMER_SA,
                    "projects": ["my-gcp-project"],
                },
            }
        )

        assert step.get_step_data(pipeline, Mock()) == {
            "customerSaEmail": _CUSTOMER_SA,
            "projects": ["my-gcp-project"],
        }

    def test_verification_step_records_result(self) -> None:
        step = GcpVerificationApiStep()
        state: dict[str, object] = {
            "config": {"customer_sa_email": _CUSTOMER_SA, "projects": ["my-gcp-project"]}
        }
        pipeline = self._make_pipeline(state=state)

        result = step.handle_post(self._validated_verification(), pipeline, Mock())

        assert result == PipelineStepResult.advance()
        assert state["verification"] == {
            "connection_status": "connected",
            "projects": [
                {
                    "gcp_project_id": "my-gcp-project",
                    "connection_status": "connected",
                    "error_detail": None,
                }
            ],
        }

    def test_verification_step_advances_when_connection_fails(self) -> None:
        step = GcpVerificationApiStep()
        state: dict[str, object] = {
            "config": {"customer_sa_email": _CUSTOMER_SA, "projects": ["my-gcp-project"]}
        }
        pipeline = self._make_pipeline(state=state)

        result = step.handle_post(
            self._validated_verification(
                connectionStatus="permission_denied",
                projects=[
                    {
                        "gcpProjectId": "my-gcp-project",
                        "connectionStatus": "permission_denied",
                        "errorDetail": "IAM roles not granted",
                    }
                ],
            ),
            pipeline,
            Mock(),
        )

        assert result == PipelineStepResult.advance()
        assert state["verification"] == {
            "connection_status": "permission_denied",
            "projects": [
                {
                    "gcp_project_id": "my-gcp-project",
                    "connection_status": "permission_denied",
                    "error_detail": "IAM roles not granted",
                }
            ],
        }

    def test_verification_step_rejects_results_for_other_projects(self) -> None:
        step = GcpVerificationApiStep()
        state: dict[str, object] = {
            "config": {
                "customer_sa_email": _CUSTOMER_SA,
                "projects": ["project-prod", "project-staging"],
            }
        }
        pipeline = self._make_pipeline(state=state)

        result = step.handle_post(
            self._validated_verification(
                projects=[{"gcpProjectId": "project-prod", "connectionStatus": "connected"}]
            ),
            pipeline,
            Mock(),
        )

        assert result.action == PipelineStepAction.ERROR
        assert "do not match the configured GCP projects" in result.data["detail"]
        assert "verification" not in state

    def test_verification_serializer_accepts_unknown_status(self) -> None:
        serializer = GcpVerificationInputSerializer(
            data={
                "connectionStatus": "quota_exceeded",
                "projects": [
                    {"gcpProjectId": "my-gcp-project", "connectionStatus": "quota_exceeded"}
                ],
            }
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["connection_status"] == "quota_exceeded"

    def test_verification_serializer_requires_at_least_one_project(self) -> None:
        serializer = GcpVerificationInputSerializer(
            data={"connectionStatus": "connected", "projects": []}
        )
        assert not serializer.is_valid()
        assert "projects" in serializer.errors

    def test_verification_step_normalizes_blank_error_detail(self) -> None:
        step = GcpVerificationApiStep()
        state: dict[str, object] = {
            "config": {"customer_sa_email": _CUSTOMER_SA, "projects": ["my-gcp-project"]}
        }
        pipeline = self._make_pipeline(state=state)

        step.handle_post(
            self._validated_verification(
                projects=[
                    {
                        "gcpProjectId": "my-gcp-project",
                        "connectionStatus": "connected",
                        "errorDetail": "",
                    }
                ],
            ),
            pipeline,
            Mock(),
        )

        verification = state["verification"]
        assert isinstance(verification, dict)
        assert verification["projects"][0]["error_detail"] is None

    # -- Build + install --

    def test_build_integration_returns_correct_data(self) -> None:
        result = self.provider.build_integration(self._state())

        assert result["external_id"] == str(self.organization.id)
        assert result["name"] == "Google Cloud Platform"
        assert result["metadata"] == {}
        assert result["post_install_data"]["sentry_sa_email"] == _SA_EMAIL
        assert result["post_install_data"]["customer_sa_email"] == _CUSTOMER_SA
        assert result["post_install_data"]["projects"] == ["my-gcp-project"]

    def test_build_integration_external_id_isolated_per_org(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_provider = GcpIntegrationProvider()
        other_provider.pipeline = Mock(organization=Mock(id=other_org.id))

        result_self = self.provider.build_integration(self._state())
        result_other = other_provider.build_integration(self._state())

        assert result_self["external_id"] != result_other["external_id"]

    def test_build_integration_multiple_projects(self) -> None:
        result = self.provider.build_integration(
            self._state(projects=["project-prod", "project-staging"])
        )
        assert result["post_install_data"]["projects"] == ["project-prod", "project-staging"]

    def test_build_integration_passes_verification_through(self) -> None:
        state = self._state()
        verification = {
            "connection_status": "connected",
            "projects": [
                {
                    "gcp_project_id": "my-gcp-project",
                    "connection_status": "connected",
                    "error_detail": None,
                }
            ],
        }
        state["verification"] = verification

        result = self.provider.build_integration(state)
        assert result["post_install_data"]["verification"] == verification

    def test_build_integration_requires_config(self) -> None:
        with pytest.raises(IntegrationConfigurationError):
            self.provider.build_integration({})

    def test_build_integration_requires_sentry_sa_email(self) -> None:
        state = self._state()
        del state["sentry_sa_email"]
        with pytest.raises(
            IntegrationConfigurationError, match="Missing Sentry service account email"
        ):
            self.provider.build_integration(state)

    def test_build_integration_validates_project_ids(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            self.provider.build_integration(self._state(projects=["INVALID"]))

    def test_post_install_stores_config(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
        )
        org_integration: OrganizationIntegration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
            integration_id=integration.id,
        )
        assert org_integration.config == {}

        self.provider.post_install(
            integration,
            self.organization,
            extra={
                "sentry_sa_email": _SA_EMAIL,
                "customer_sa_email": _CUSTOMER_SA,
                "projects": ["my-gcp-project"],
                "verification": {
                    "connection_status": "connected",
                    "projects": [
                        {
                            "gcp_project_id": "my-gcp-project",
                            "connection_status": "connected",
                            "error_detail": None,
                        }
                    ],
                },
            },
        )

        org_integration.refresh_from_db()
        assert org_integration.config["sentry_sa_email"] == _SA_EMAIL
        assert org_integration.config["customer_sa_email"] == _CUSTOMER_SA
        assert org_integration.config["projects"] == ["my-gcp-project"]

    def test_post_install_stores_verification_status(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
        )

        self.provider.post_install(
            integration,
            self.organization,
            extra={
                "sentry_sa_email": _SA_EMAIL,
                "customer_sa_email": _CUSTOMER_SA,
                "projects": ["my-gcp-project"],
                "verification": {
                    "connection_status": "permission_denied",
                    "projects": [
                        {
                            "gcp_project_id": "my-gcp-project",
                            "connection_status": "permission_denied",
                            "error_detail": "IAM roles not granted",
                        }
                    ],
                },
            },
        )

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
            integration_id=integration.id,
        )
        assert org_integration.config["connection_status"] == "permission_denied"
        assert org_integration.config["project_statuses"] == [
            {
                "gcp_project_id": "my-gcp-project",
                "connection_status": "permission_denied",
                "error_detail": "IAM roles not granted",
            }
        ]
        assert org_integration.config["last_verified_at"]

    def test_post_install_records_error_when_verification_missing(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
        )

        self.provider.post_install(
            integration,
            self.organization,
            extra={
                "sentry_sa_email": _SA_EMAIL,
                "customer_sa_email": _CUSTOMER_SA,
                "projects": ["my-gcp-project"],
                "verification": None,
            },
        )

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
            integration_id=integration.id,
        )
        assert org_integration.config["connection_status"] == "error"
        assert org_integration.config["last_verified_at"] is None
        assert org_integration.config["project_statuses"] == [
            {
                "gcp_project_id": "my-gcp-project",
                "connection_status": "error",
                "error_detail": "Verification failed to run during setup.",
            }
        ]

    # -- Installed integration: config access --

    def test_installation_reads_config(self) -> None:
        installation = self._create_installed_integration(
            projects=["my-gcp-project", "my-gcp-staging"]
        )
        config = installation.gcp_config
        assert config is not None
        assert config["sentry_sa_email"] == _SA_EMAIL
        assert config["customer_sa_email"] == _CUSTOMER_SA
        assert config["projects"] == ["my-gcp-project", "my-gcp-staging"]

    def test_installation_returns_none_config_without_org_integration(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
        )
        other_org = self.create_organization(owner=self.user)
        installation = integration.get_installation(organization_id=other_org.id)
        assert isinstance(installation, GcpIntegration)
        assert installation.gcp_config is None

    # -- Editing integration configuration --

    def _stored_config(self) -> dict[str, Any]:
        oi = OrganizationIntegration.objects.get(organization_id=self.organization.id)
        assert isinstance(oi.config, dict)
        return oi.config

    def test_update_config_changes_customer_sa_email_and_marks_unverified(self) -> None:
        installation = self._create_installed_integration()

        installation.update_organization_config({"customer_sa_email": "new@customer.com"})

        config = self._stored_config()
        assert config["customer_sa_email"] == "new@customer.com"
        assert config["sentry_sa_email"] == _SA_EMAIL
        assert config["connection_status"] == GCP_STATUS_UNVERIFIED
        assert config["last_verified_at"] is None
        assert config["project_statuses"] == [
            {
                "gcp_project_id": "my-gcp-project",
                "connection_status": GCP_STATUS_UNVERIFIED,
                "error_detail": None,
            }
        ]

    def test_update_config_parses_dedupes_and_trims_projects(self) -> None:
        installation = self._create_installed_integration()

        installation.update_organization_config(
            {"projects": " project-prod , project-staging ,project-prod"}
        )

        config = self._stored_config()
        assert config["projects"] == ["project-prod", "project-staging"]
        assert [p["gcp_project_id"] for p in config["project_statuses"]] == [
            "project-prod",
            "project-staging",
        ]
        assert config["connection_status"] == GCP_STATUS_UNVERIFIED

    def test_update_config_reordering_projects_is_not_a_change(self) -> None:
        installation = self._create_installed_integration(
            projects=["project-prod", "project-staging"]
        )

        installation.update_organization_config({"projects": "project-staging, project-prod"})

        config = self._stored_config()
        assert config["projects"] == ["project-prod", "project-staging"]
        assert config["connection_status"] == "connected"
        assert config["last_verified_at"] == "2026-08-01T00:00:00+00:00"

    def test_update_config_changing_the_project_set_marks_unverified(self) -> None:
        installation = self._create_installed_integration(
            projects=["project-prod", "project-staging"]
        )

        installation.update_organization_config({"projects": "project-staging, project-new"})

        config = self._stored_config()
        assert config["connection_status"] == GCP_STATUS_UNVERIFIED
        assert config["last_verified_at"] is None

    def test_update_config_rejects_invalid_project_id(self) -> None:
        installation = self._create_installed_integration()

        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            installation.update_organization_config({"projects": "INVALID"})

        assert self._stored_config()["projects"] == ["my-gcp-project"]

    def test_update_config_rejects_empty_projects(self) -> None:
        installation = self._create_installed_integration()

        with pytest.raises(IntegrationConfigurationError, match="At least one GCP project ID"):
            installation.update_organization_config({"projects": "  ,  "})

    def test_update_config_rejects_empty_customer_sa_email(self) -> None:
        installation = self._create_installed_integration()

        with pytest.raises(IntegrationConfigurationError, match="is required"):
            installation.update_organization_config({"customer_sa_email": "   "})

        assert self._stored_config()["customer_sa_email"] == _CUSTOMER_SA

    def test_update_config_ignores_sentry_sa_email(self) -> None:
        installation = self._create_installed_integration()
        installation.update_organization_config(
            {
                "sentry_sa_email": "evil@attacker.iam.gserviceaccount.com",
                "customer_sa_email": "new@customer.com",
            }
        )
        assert self._stored_config()["sentry_sa_email"] == _SA_EMAIL

    def test_update_config_noop_when_nothing_changed(self) -> None:
        installation = self._create_installed_integration()
        installation.update_organization_config(
            {"customer_sa_email": _CUSTOMER_SA, "projects": "my-gcp-project"}
        )

        config = self._stored_config()
        assert config["connection_status"] == "connected"
        assert config["last_verified_at"] == "2026-08-01T00:00:00+00:00"

    def test_update_config_requires_existing_config(self) -> None:
        self._create_installed_integration()
        oi = OrganizationIntegration.objects.get(organization_id=self.organization.id)
        oi.update(config={})

        installation = oi.integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, GcpIntegration)

        with pytest.raises(IntegrationConfigurationError, match="not configured"):
            installation.update_organization_config({"customer_sa_email": "new@customer.com"})

    def test_get_organization_config_only_locks_the_sentry_sa(self) -> None:
        installation = self._create_installed_integration()
        fields = {f["name"]: f for f in installation.get_organization_config()}

        assert list(fields) == ["sentry_sa_email", "customer_sa_email", "projects"]
        assert fields["sentry_sa_email"]["disabled"] is True
        assert "disabled" not in fields["customer_sa_email"]
        assert "disabled" not in fields["projects"]

    def test_get_config_data_flattens_projects(self) -> None:
        installation = self._create_installed_integration(
            projects=["project-a", "project-b", "project-c"]
        )
        data = installation.get_config_data()

        assert data["sentry_sa_email"] == _SA_EMAIL
        assert data["customer_sa_email"] == _CUSTOMER_SA
        assert data["projects"] == "project-a, project-b, project-c"

    def test_get_config_data_exposes_the_connection_status(self) -> None:
        installation = self._create_installed_integration()
        data = installation.get_config_data()

        assert data["connection_status"] == "connected"
        assert data["last_verified_at"] == "2026-08-01T00:00:00+00:00"
        assert data["project_statuses"] == [
            {
                "gcp_project_id": "my-gcp-project",
                "connection_status": "connected",
                "error_detail": None,
            }
        ]

    def test_get_config_data_defaults_to_unverified(self) -> None:
        self._create_installed_integration()
        oi = OrganizationIntegration.objects.get(organization_id=self.organization.id)
        oi.update(
            config={
                "sentry_sa_email": _SA_EMAIL,
                "customer_sa_email": _CUSTOMER_SA,
                "projects": ["my-gcp-project"],
            }
        )

        installation = oi.integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, GcpIntegration)
        data = installation.get_config_data()

        assert data["connection_status"] == GCP_STATUS_UNVERIFIED
        assert data["project_statuses"] == []
        assert data["last_verified_at"] is None

    def test_get_config_data_empty_without_config(self) -> None:
        self._create_installed_integration()
        oi = OrganizationIntegration.objects.get(organization_id=self.organization.id)
        oi.update(config={})

        reinstalled = oi.integration.get_installation(organization_id=self.organization.id)
        assert isinstance(reinstalled, GcpIntegration)
        assert reinstalled.get_config_data() == {}

    # -- Uninstall: SA deletion --

    def test_uninstall_deletes_sa_and_model_row(self) -> None:
        installation = self._create_installed_integration()
        self.create_gcp_service_account(
            organization=self.organization,
            service_account_email=_SA_EMAIL,
        )

        with _mock_iam_session() as mock_get_session:
            mock_session = mock_get_session.return_value
            mock_session.delete.return_value = Mock(ok=True, status_code=200)

            installation.uninstall()

        mock_session.delete.assert_called_once_with(
            f"{_GCP_IAM_BASE}/projects/{_CONNECTORS_PROJECT}/serviceAccounts/{_SA_EMAIL}"
        )
        assert not GcpServiceAccount.objects.filter(organization_id=self.organization.id).exists()

    def test_uninstall_tolerates_already_deleted_sa(self) -> None:
        installation = self._create_installed_integration()
        self.create_gcp_service_account(
            organization=self.organization,
            service_account_email=_SA_EMAIL,
        )

        with _mock_iam_session() as mock_get_session:
            mock_session = mock_get_session.return_value
            mock_session.delete.return_value = Mock(ok=False, status_code=404)

            installation.uninstall()

    def test_uninstall_tolerates_gcp_api_errors(self) -> None:
        installation = self._create_installed_integration()
        self.create_gcp_service_account(
            organization=self.organization,
            service_account_email=_SA_EMAIL,
        )

        with _mock_iam_session() as mock_get_session:
            mock_session = mock_get_session.return_value
            mock_session.delete.return_value = Mock(ok=False, status_code=500)

            installation.uninstall()

        assert not GcpServiceAccount.objects.filter(organization_id=self.organization.id).exists()

    def test_uninstall_noop_without_config(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="gcp",
            external_id=str(self.organization.id),
            name="Google Cloud Platform",
            metadata={},
        )
        installation = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, GcpIntegration)

        with patch("sentry.integrations.gcp.integration.delete_sentry_sa") as mock_delete:
            installation.uninstall()

        mock_delete.assert_not_called()

    # -- Validation --

    def test_validate_gcp_project_id_accepts_valid_ids(self) -> None:
        for project_id in [
            "my-project",
            "project-123",
            "a12345",
            "abcdef",
            "my-cool-project-name-here-12",
        ]:
            validate_gcp_project_id(project_id)

    def test_parse_gcp_project_ids_accepts_a_list(self) -> None:
        assert parse_gcp_project_ids(["project-a", "project-b"]) == ["project-a", "project-b"]

    def test_parse_gcp_project_ids_rejects_unusable_input(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="comma-separated list"):
            parse_gcp_project_ids(42)

    def test_parse_customer_sa_email_trims(self) -> None:
        assert parse_customer_sa_email("  cust@customer.com  ") == "cust@customer.com"

    def test_parse_customer_sa_email_requires_a_value(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="is required"):
            parse_customer_sa_email("   ")

    def test_parse_customer_sa_email_rejects_overlong_values(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="at most"):
            parse_customer_sa_email("a" * 250 + "@customer.com")

    def test_resolve_project_error_detail_prefers_the_project_level_message(self) -> None:
        detail = resolve_project_error_detail(
            {
                "gcp_project_id": "project-a",
                "connection_status": "permission_denied",
                "error_detail": "SA impersonation chain failed",
                "services": [
                    {"service": "logging", "status": "permission_denied", "error_detail": "nope"}
                ],
            }
        )
        assert detail == "SA impersonation chain failed"

    def test_resolve_project_error_detail_rolls_up_failing_services(self) -> None:
        detail = resolve_project_error_detail(
            {
                "gcp_project_id": "project-a",
                "connection_status": "error",
                "error_detail": None,
                "services": [
                    {"service": "logging", "status": "connected", "error_detail": None},
                    {
                        "service": "monitoring",
                        "status": "api_disabled",
                        "error_detail": "API is disabled",
                    },
                    {
                        "service": "cloudtrace",
                        "status": "project_not_found",
                        "error_detail": "Project not found",
                    },
                ],
            }
        )
        assert detail == ("Cloud Monitoring: API is disabled; Cloud Trace: Project not found")

    def test_resolve_project_error_detail_handles_unknown_service(self) -> None:
        detail = resolve_project_error_detail(
            {
                "gcp_project_id": "project-a",
                "connection_status": "error",
                "error_detail": None,
                "services": [{"service": "brand-new", "status": "error", "error_detail": None}],
            }
        )
        assert detail == "brand-new: Unknown error"

    def test_resolve_project_error_detail_is_none_when_connected(self) -> None:
        detail = resolve_project_error_detail(
            {
                "gcp_project_id": "project-a",
                "connection_status": "connected",
                "error_detail": None,
                "services": [{"service": "logging", "status": "connected", "error_detail": None}],
            }
        )
        assert detail is None

    def test_validate_gcp_project_id_rejects_invalid_ids(self) -> None:
        for project_id in [
            "ab123",
            "a" * 31,
            "1project",
            "my-project-",
            "My-Project",
            "my_project",
        ]:
            with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
                validate_gcp_project_id(project_id)
