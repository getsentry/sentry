from __future__ import annotations

from unittest.mock import Mock

import pytest

from sentry.integrations.gcp.integration import (
    GcpIntegration,
    GcpIntegrationProvider,
    validate_gcp_project_id,
)
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
        return {"config": config}

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
        org_integration = integration.organizationintegration_set.get(
            organization_id=self.organization.id
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
