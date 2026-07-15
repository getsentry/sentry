from __future__ import annotations

import pytest

from sentry.integrations.gcp.integration import (
    DEFAULT_ENABLED_SERVICES,
    GCP_SA_EMAIL_BY_REGION,
    GcpConnectionStatus,
    GcpIntegration,
    GcpIntegrationProvider,
    sa_email_for_region,
    validate_gcp_project_id,
)
from sentry.integrations.models.integration import Integration
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


class ValidateGcpProjectIdTest(TestCase):
    def test_valid_project_ids(self) -> None:
        for project_id in [
            "my-project",
            "project-123",
            "a12345",
            "abcdef",
            "my-cool-project-name-here-12",
        ]:
            validate_gcp_project_id(project_id)

    def test_too_short(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            validate_gcp_project_id("ab123")

    def test_too_long(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            validate_gcp_project_id("a" * 31)

    def test_starts_with_digit(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            validate_gcp_project_id("1project")

    def test_ends_with_hyphen(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            validate_gcp_project_id("my-project-")

    def test_uppercase_rejected(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            validate_gcp_project_id("My-Project")

    def test_underscore_rejected(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            validate_gcp_project_id("my_project")


class SaEmailMappingTest(TestCase):
    def test_known_regions(self) -> None:
        assert sa_email_for_region("us") == "service-seer@internal-sentry.iam.gserviceaccount.com"
        assert sa_email_for_region("us2") == "service-seer@sentry-us2.iam.gserviceaccount.com"
        assert sa_email_for_region("de") == "service-seer@sentry-eu-west3.iam.gserviceaccount.com"

    def test_unknown_region(self) -> None:
        assert sa_email_for_region("unknown") is None

    def test_all_regions_mapped(self) -> None:
        assert set(GCP_SA_EMAIL_BY_REGION.keys()) == {"us", "us2", "de"}


@control_silo_test
class GcpIntegrationProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = GcpIntegrationProvider()

    def _state(self, **overrides: object) -> dict[str, object]:
        config: dict[str, object] = {"gcp_project_id": "my-gcp-project"}
        config.update(overrides)
        return {"config": config}

    def test_build_integration_stores_metadata(self) -> None:
        result = self.provider.build_integration(self._state())

        assert result["external_id"] == "my-gcp-project"
        assert result["name"] == "GCP (my-gcp-project)"
        assert result["metadata"]["gcp_project_id"] == "my-gcp-project"
        assert result["metadata"]["display_name"] == "my-gcp-project"
        assert result["metadata"]["status"] == GcpConnectionStatus.PENDING_VERIFICATION
        assert result["metadata"]["enabled_services"] == list(DEFAULT_ENABLED_SERVICES)

    def test_build_integration_custom_display_name(self) -> None:
        result = self.provider.build_integration(self._state(display_name="Production GCP"))

        assert result["metadata"]["display_name"] == "Production GCP"

    def test_build_integration_custom_enabled_services(self) -> None:
        result = self.provider.build_integration(self._state(enabled_services=["monitoring"]))

        assert result["metadata"]["enabled_services"] == ["monitoring"]

    def test_build_integration_requires_config(self) -> None:
        with pytest.raises(IntegrationConfigurationError):
            self.provider.build_integration({})

    def test_build_integration_validates_project_id(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Invalid GCP project ID"):
            self.provider.build_integration(self._state(gcp_project_id="INVALID"))

    def test_installation_reads_config(self) -> None:
        integration = Integration.objects.create(
            provider="gcp_sa",
            external_id="my-gcp-project",
            name="GCP (my-gcp-project)",
            metadata={
                "gcp_project_id": "my-gcp-project",
                "display_name": "My GCP Project",
                "status": GcpConnectionStatus.ACTIVE,
                "enabled_services": ["monitoring", "logging"],
            },
        )
        installation = integration.get_installation(organization_id=self.organization.id)

        assert isinstance(installation, GcpIntegration)
        assert installation.gcp_project_id == "my-gcp-project"
        assert installation.display_name == "My GCP Project"
        assert installation.status == GcpConnectionStatus.ACTIVE
        assert installation.enabled_services == ["monitoring", "logging"]

    def test_provider_is_hidden_single_install_and_flagged(self) -> None:
        assert self.provider.key == "gcp_sa"
        assert self.provider.visible is False
        assert self.provider.allow_multiple is False
        assert self.provider.requires_feature_flag is True
