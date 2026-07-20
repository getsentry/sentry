from __future__ import annotations

from unittest.mock import Mock

import pytest

from sentry.integrations.gcp.integration import (
    GcpIntegration,
    GcpIntegrationProvider,
    GcpSaGenerationApiStep,
)
from sentry.integrations.gcp.utils import generate_sentry_sa, validate_gcp_project_id
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.pipeline.types import PipelineStepResult
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GcpIntegrationProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = GcpIntegrationProvider()
        self.provider.pipeline = Mock(organization=Mock(id=self.organization.id))

    def _state(self, **overrides: object) -> dict[str, object]:
        config: dict[str, object] = {
            "customer_sa_email": "gcp-sentry@customer-project.iam.gserviceaccount.com",
            "projects": ["my-gcp-project"],
        }
        config.update(overrides)
        return {
            "config": config,
            "sentry_sa_email": generate_sentry_sa(self.organization.id),
        }

    def test_sa_generation_step_returns_sentry_sa_email(self) -> None:
        step = GcpSaGenerationApiStep()
        pipeline = Mock(organization=Mock(id=self.organization.id))
        request = Mock()

        step_data = step.get_step_data(pipeline, request)

        expected_email = (
            f"sentry-org-{self.organization.id}@sentry-connectors.iam.gserviceaccount.com"
        )
        assert step_data["sentrySaEmail"] == expected_email
        pipeline.bind_state.assert_called_with("sentry_sa_email", expected_email)

    def test_sa_generation_step_advances_on_post(self) -> None:
        step = GcpSaGenerationApiStep()
        result = step.handle_post(None, Mock(), Mock())
        assert result == PipelineStepResult.advance()

    def test_validate_gcp_project_id_accepts_valid_ids(self) -> None:
        for project_id in [
            "my-project",
            "project-123",
            "a12345",
            "abcdef",
            "my-cool-project-name-here-12",
        ]:
            validate_gcp_project_id(project_id)

    def test_validate_gcp_project_id_rejects_invalid_ids(self) -> None:
        for project_id in [
            "ab123",  # too short
            "a" * 31,  # too long
            "1project",  # starts with digit
            "my-project-",  # ends with hyphen
            "My-Project",  # uppercase
            "my_project",  # underscore
        ]:
            with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
                validate_gcp_project_id(project_id)

    def test_build_integration_returns_correct_data(self) -> None:
        result = self.provider.build_integration(self._state())

        assert result["external_id"] == str(self.organization.id)
        assert result["name"] == "Google Cloud Platform"
        assert result["metadata"] == {}
        assert result["post_install_data"]["sentry_sa_email"] == generate_sentry_sa(
            self.organization.id
        )
        assert result["post_install_data"]["customer_sa_email"] == (
            "gcp-sentry@customer-project.iam.gserviceaccount.com"
        )
        assert result["post_install_data"]["projects"] == ["my-gcp-project"]

    def test_build_integration_external_id_isolated_per_org(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_provider = GcpIntegrationProvider()
        other_provider.pipeline = Mock(organization=Mock(id=other_org.id))

        result_self = self.provider.build_integration(self._state())
        result_other = other_provider.build_integration(self._state())

        assert result_self["external_id"] == str(self.organization.id)
        assert result_other["external_id"] == str(other_org.id)
        assert result_self["external_id"] != result_other["external_id"]

    def test_build_integration_multiple_projects(self) -> None:
        result = self.provider.build_integration(
            self._state(projects=["project-prod", "project-staging"])
        )
        assert result["post_install_data"]["projects"] == ["project-prod", "project-staging"]

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

    def test_post_install_sets_org_integration_config(self) -> None:
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
                "sentry_sa_email": "sentry-abc123@sentry-connectors.iam.gserviceaccount.com",
                "customer_sa_email": "gcp-sentry@customer-project.iam.gserviceaccount.com",
                "projects": ["my-gcp-project"],
            },
        )

        org_integration.refresh_from_db()
        assert org_integration.config["sentry_sa_email"] == (
            "sentry-abc123@sentry-connectors.iam.gserviceaccount.com"
        )
        assert org_integration.config["customer_sa_email"] == (
            "gcp-sentry@customer-project.iam.gserviceaccount.com"
        )
        assert org_integration.config["projects"] == ["my-gcp-project"]

    def test_installation_reads_config_from_org_integration(self) -> None:
        gcp_config = {
            "sentry_sa_email": "sentry-abc123@sentry-connectors.iam.gserviceaccount.com",
            "customer_sa_email": "gcp-sentry@customer-project.iam.gserviceaccount.com",
            "projects": ["my-gcp-project", "my-gcp-staging"],
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

        config = installation.gcp_config
        assert config is not None
        assert (
            config["sentry_sa_email"] == "sentry-abc123@sentry-connectors.iam.gserviceaccount.com"
        )
        assert config["customer_sa_email"] == "gcp-sentry@customer-project.iam.gserviceaccount.com"
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
